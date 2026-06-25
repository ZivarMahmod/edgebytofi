/* EDGE by Tofi — /api/rating
   Cloudflare Pages Function. Hämtar betyg + antal från Bokadirekt,
   cachar på edgen (Cache API, ~12h soft TTL, stale-while-revalidate),
   exponerar JSON. Failar aldrig mot klienten — fallback 5,0 / 12.
*/

const SOURCE_URL = 'https://www.bokadirekt.se/places/edge-by-tofi-136651';
const STORE_TTL  = 604800; // caches.default-retention, 7 dygn
const SOFT_TTL   = 43200;  // 12h: äldre än så → bakgrundsuppdatering
const CLIENT_TTL = 3600;   // webbläsare/edge-cache av /api/rating, 1h
const FALLBACK   = { rating: 5.0, count: 12, source: 'fallback' };
const CACHE_KEY  = new Request('https://rating.internal/edgebytofi', { method: 'GET' });

export async function onRequestGet(context) {
  const cache = caches.default;

  const hit = await cache.match(CACHE_KEY);
  if (hit) {
    let data = null;
    try { data = await hit.json(); } catch { /* corrupt entry → behandla som miss */ }
    if (data) {
      const age = (Date.now() - Date.parse(data.updated || 0)) / 1000;
      if (!Number.isFinite(age) || age > SOFT_TTL) {
        context.waitUntil(revalidate(cache)); // stale-while-revalidate
      }
      return clientResponse(data, 'HIT');
    }
  }

  // Cache-miss → hämta synkront
  const data = await load(cache);
  return clientResponse(data, data.source === 'fallback' ? 'MISS-FALLBACK' : 'MISS');
}

async function load(cache) {
  try {
    const data = await scrape();
    await cache.put(CACHE_KEY, storeResponse(data));
    return data;
  } catch {
    // Cacha INTE fallback — nästa anrop ska försöka hämta på nytt.
    return { ...FALLBACK, updated: new Date().toISOString() };
  }
}

async function revalidate(cache) {
  try {
    const data = await scrape();
    await cache.put(CACHE_KEY, storeResponse(data));
  } catch { /* behåll befintlig cache vid fel */ }
}

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
  return { rating: parsed.rating, count, source: 'bokadirekt', updated: new Date().toISOString() };
}

function parseJsonLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let json;
    try { json = JSON.parse(m[1].trim()); } catch { continue; }
    const ar = findAggregate(json);
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

function storeResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, s-maxage=${STORE_TTL}`,
    },
  });
}

function clientResponse(data, cacheState) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CLIENT_TTL}`,
      'X-Rating-Cache': cacheState,
      'Access-Control-Allow-Origin': '*',
    },
  });
}
