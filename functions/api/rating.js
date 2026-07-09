/* EDGE by Tofi — /api/rating (Cloudflare Pages Function)
   Läser betyget ur KV (RATING_KV/"rating"), som skrivs av rating-cron-Workern
   varje morgon. Tomt/ogiltigt KV → engångshämtning från Bokadirekt + skriv KV.
   Svarar även med 3 textrecensioner ur poolen (RATING_KV/"reviews" — ALLA
   textrecensioner, hämtas av Workern via Bokadirekts publika JSON-API) —
   urvalet roteras deterministiskt var 3:e dag, blandat 4–5 stjärnor.
   Saknad binding eller annat fel → fallback 5,0 / 12 utan recensioner. Svarar ALDRIG 500.
*/

const SOURCE_URL = 'https://www.bokadirekt.se/places/edge-by-tofi-136651';
const REVIEWS_URL = 'https://www.bokadirekt.se/api/places/reviews/136651';
const KV_KEY = 'rating';
const REVIEWS_KEY = 'reviews';
const MAX_POOL = 40;
const FALLBACK = { rating: 5.0, count: 12, source: 'fallback' };

export async function onRequestGet(context) {
  const { env, waitUntil } = context;
  try {
    if (env && env.RATING_KV) {
      const reviews = await readReviews(env);
      const raw = await env.RATING_KV.get(KV_KEY);
      const data = raw ? safeParse(raw) : null;
      if (data && typeof data.rating === 'number' && Number.isInteger(data.count)) {
        return json({ rating: data.rating, count: data.count, ...reviews, source: 'kv', updated: data.updated }, 600);
      }
      // KV tomt/ogiltigt (t.ex. före första cron-passet) → engångshämtning
      try {
        const parsed = await scrape();
        const fresh = { rating: parsed.rating, count: parsed.count, updated: new Date().toISOString() };
        const put = env.RATING_KV.put(KV_KEY, JSON.stringify(fresh));
        if (waitUntil) waitUntil(put); else await put;
        let pool = [];
        try {
          pool = await fetchReviews();
          if (pool.length) await env.RATING_KV.put(REVIEWS_KEY, JSON.stringify(pool.slice(0, MAX_POOL)));
        } catch { /* recensioner är progressivt — betyget räcker */ }
        return json({ ...fresh, ...pickReviews(pool), source: 'bokadirekt' }, 600);
      } catch { /* faller igenom till fallback */ }
    }
  } catch { /* faller igenom till fallback */ }
  return json({ ...FALLBACK, updated: new Date().toISOString() }, 60);
}

// Läs poolen och välj dagens 3.
async function readReviews(env) {
  try {
    const raw = await env.RATING_KV.get(REVIEWS_KEY);
    const pool = (raw && safeParse(raw)) || [];
    return pickReviews(pool);
  } catch { return pickReviews([]); }
}

// Deterministiskt roterande urval: samma 3 recensioner i 3 dagar, sedan nästa
// blandning. Seedad shuffle (LCG) på 3-dagarsperioden → blandat 4–5 stjärnor
// utan lagrat tillstånd.
function pickReviews(pool) {
  const valid = (pool || []).filter((r) => r && r.name && r.text && r.rating >= 4);
  if (!valid.length) return { reviews: [], reviewsTotal: 0 };
  const period = Math.floor(Date.now() / 86400000 / 3);
  let s = period * 2654435761 % 2147483647 || 1;
  const rand = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const shuffled = valid.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { reviews: shuffled.slice(0, 3), reviewsTotal: valid.length };
}

// Alla textrecensioner via Bokadirekts publika JSON-API — samma som Workern.
// Används bara vid engångshämtningen innan första cron-passet.
async function fetchReviews() {
  const res = await fetch(REVIEWS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0', 'Accept': 'application/json', 'Accept-Language': 'sv-SE' },
    cf: { cacheTtl: 0 },
  });
  if (!res.ok) throw new Error('reviews status ' + res.status);
  const data = await res.json();
  const out = [];
  for (const item of (data && data.reviews) || []) {
    const r = item && item.review;
    if (!r) continue;
    const text = (r.text || '').trim();
    if (r.score >= 4 && text && r.author) {
      out.push({ name: r.author, rating: r.score, date: r.createdAt || '', text });
    }
  }
  return out;
}

function json(obj, sMaxAge) {
  const maxAge = sMaxAge > 300 ? 300 : sMaxAge;
  return new Response(JSON.stringify(obj), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${sMaxAge}`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

// ---- Engångshämtning från Bokadirekt (samma parse som Workern) ----
async function scrape() {
  const res = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'sv-SE,sv;q=0.9',
    },
    cf: { cacheTtl: 0 },
  });
  if (!res.ok) throw new Error('source status ' + res.status);
  const html = await res.text();
  const parsed = parseJsonLd(html) || parseRegex(html);
  if (!parsed || isNaN(parsed.rating)) throw new Error('no rating parsed');
  const count = (parsed.count != null && !isNaN(parsed.count)) ? parsed.count : FALLBACK.count;
  return { rating: parsed.rating, count };
}

function parseJsonLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const ar = findAggregate(data);
    if (ar && ar.ratingValue != null) {
      const rating = parseFloat(String(ar.ratingValue).replace(',', '.'));
      const raw = ar.reviewCount != null ? ar.reviewCount : ar.ratingCount;
      const count = raw != null ? parseInt(String(raw), 10) : null;
      if (!isNaN(rating)) return { rating, count };
    }
  }
  return null;
}

function findAggregate(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.aggregateRating && typeof node.aggregateRating === 'object') return node.aggregateRating;
  if (node['@type'] === 'AggregateRating' && node.ratingValue != null) return node;
  if (Array.isArray(node)) {
    for (const x of node) { const r = findAggregate(x); if (r) return r; }
    return null;
  }
  for (const k of Object.keys(node)) { const r = findAggregate(node[k]); if (r) return r; }
  return null;
}

function parseRegex(html) {
  const rv = html.match(/"ratingValue"\s*:\s*"?([\d.,]+)"?/i);
  const rc = html.match(/"(?:reviewCount|ratingCount)"\s*:\s*"?(\d+)"?/i);
  let rating = rv ? parseFloat(rv[1].replace(',', '.')) : NaN;
  let count = rc ? parseInt(rc[1], 10) : null;
  if (isNaN(rating)) {
    const t = html.match(/\b([0-5][.,]\d)\b/);
    if (t) rating = parseFloat(t[1].replace(',', '.'));
  }
  if (count == null) {
    const c = html.match(/(\d+)\s*(?:betyg|omd[öo]men|recensioner)/i);
    if (c) count = parseInt(c[1], 10);
  }
  if (isNaN(rating)) return null;
  return { rating, count };
}
