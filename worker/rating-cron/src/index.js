/* EDGE by Tofi — rating-cron Worker
   Schemalagt morgonpass (cron 0 4 * * * UTC ≈ 06:00 svensk tid).
   Hämtar betyg + antal från Bokadirekt, skriver till KV (RATING_KV/"rating").
   Hämtar även senaste textrecensionerna (JSON-LD exponerar de 4 senaste) och
   ackumulerar dem i en pool (RATING_KV/"reviews") — dedupe på namn+datum,
   endast 4–5 stjärnor, max 40 st. Poolen växer över tid för varje cron-pass.
   Skriver ALDRIG över ett tidigare giltigt värde med skräp.
   Manuell provkörning: GET ?run=1
*/

const SOURCE_URL = 'https://www.bokadirekt.se/places/edge-by-tofi-136651';
const KV_KEY = 'rating';
const REVIEWS_KEY = 'reviews';
const MAX_POOL = 40;
const FALLBACK_COUNT = 12;

export default {
  // Cron — körs dagligen 04:00 UTC.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refresh(env));
  },

  // Manuell trigger + statusvy.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get('run') === '1') {
      const result = await refresh(env);
      return json(result);
    }
    const current = await readKv(env);
    return json({ worker: 'edgebytofi-rating-cron', cron: '0 4 * * * (UTC)', current });
  },
};

// Hämta + parsa + skriv KV. Vid fel: behåll förra värdet.
async function refresh(env) {
  let parsed;
  try {
    parsed = await scrape();
  } catch (e) {
    const kept = await readKv(env);
    return { ok: false, written: false, error: String(e && e.message || e), kept };
  }
  const data = {
    rating: parsed.rating,
    count: parsed.count,
    updated: new Date().toISOString(),
  };
  if (env.RATING_KV) {
    await env.RATING_KV.put(KV_KEY, JSON.stringify(data));
    const pool = await mergeReviews(env, parsed.reviews);
    return { ok: true, written: true, data, reviewsInPool: pool.length };
  }
  return { ok: true, written: false, reason: 'no RATING_KV binding', data };
}

// Slå ihop nyskrapade recensioner med poolen i KV. Dedupe på namn+datum,
// nyaste först, max MAX_POOL.
async function mergeReviews(env, fresh) {
  const raw = await env.RATING_KV.get(REVIEWS_KEY);
  const pool = (raw && safeParse(raw)) || [];
  const seen = new Set(pool.map((r) => r.name + '|' + r.date));
  for (const r of fresh || []) {
    const key = r.name + '|' + r.date;
    if (!seen.has(key)) { seen.add(key); pool.push(r); }
  }
  pool.sort((a, b) => (a.date < b.date ? 1 : -1));
  const capped = pool.slice(0, MAX_POOL);
  await env.RATING_KV.put(REVIEWS_KEY, JSON.stringify(capped));
  return capped;
}

async function readKv(env) {
  if (!env.RATING_KV) return null;
  const raw = await env.RATING_KV.get(KV_KEY);
  return raw ? safeParse(raw) : null;
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ---- Scrape Bokadirekt ----
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
  const count = (parsed.count != null && !isNaN(parsed.count)) ? parsed.count : FALLBACK_COUNT;
  return { rating: parsed.rating, count, reviews: parseReviews(html) };
}

// Textrecensioner ur JSON-LD (LocalBusiness.review). Endast 4–5 stjärnor
// med text. Format: { name, rating, date, text }.
function parseReviews(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const list = Array.isArray(data) ? data : [data];
    for (const node of list) {
      const reviews = node && node.review;
      if (!Array.isArray(reviews)) continue;
      for (const r of reviews) {
        const rating = r && r.reviewRating ? parseFloat(r.reviewRating.ratingValue) : NaN;
        const text = (r && r.reviewBody || '').trim();
        const name = r && r.author && r.author.name || '';
        const date = r && r.datePublished || '';
        if (rating >= 4 && text && name) out.push({ name, rating, date, text });
      }
    }
  }
  return out;
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
