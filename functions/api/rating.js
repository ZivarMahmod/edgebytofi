/* EDGE by Tofi — /api/rating (Cloudflare Pages Function)
   Läser betyget ur KV (RATING_KV/"rating"), som skrivs av rating-cron-Workern
   varje morgon. Tomt/ogiltigt KV → engångshämtning från Bokadirekt + skriv KV.
   Saknad binding eller annat fel → fallback 5,0 / 12. Svarar ALDRIG 500.
*/

const SOURCE_URL = 'https://www.bokadirekt.se/places/edge-by-tofi-136651';
const KV_KEY = 'rating';
const FALLBACK = { rating: 5.0, count: 12, source: 'fallback' };

export async function onRequestGet(context) {
  const { env, waitUntil } = context;
  try {
    if (env && env.RATING_KV) {
      const raw = await env.RATING_KV.get(KV_KEY);
      const data = raw ? safeParse(raw) : null;
      if (data && typeof data.rating === 'number' && Number.isInteger(data.count)) {
        return json({ rating: data.rating, count: data.count, source: 'kv', updated: data.updated }, 600);
      }
      // KV tomt/ogiltigt (t.ex. före första cron-passet) → engångshämtning
      try {
        const parsed = await scrape();
        const fresh = { rating: parsed.rating, count: parsed.count, updated: new Date().toISOString() };
        const put = env.RATING_KV.put(KV_KEY, JSON.stringify(fresh));
        if (waitUntil) waitUntil(put); else await put;
        return json({ ...fresh, source: 'bokadirekt' }, 600);
      } catch { /* faller igenom till fallback */ }
    }
  } catch { /* faller igenom till fallback */ }
  return json({ ...FALLBACK, updated: new Date().toISOString() }, 60);
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
