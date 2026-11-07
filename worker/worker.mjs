// Only these three upstream feeds can be requested through this Worker.
const SOURCES = {
  Z: ['https://www.zoomg.ir/feed/', 'https://www.zoomg.ir/rss/'],
  V: ['https://vigiato.net/feed/'],
  G: ['https://gamefa.com/feed/'],
};

const SITE_ORIGIN = 'https://amin-hashempour.github.io';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin === SITE_ORIGIN ? origin : SITE_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

async function fetchFeed(code) {
  for (const url of SOURCES[code]) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
          'User-Agent': 'Mozilla/5.0 (compatible; BoogeyGameNews/1.0)',
        },
        cf: { cacheEverything: true, cacheTtl: 60 },
      });
      if (!response.ok) continue;
      const xml = await response.text();
      if (!/<(?:rss|feed)(?:\s|>)/i.test(xml)) continue;
      return xml;
    } catch {}
  }
  throw new Error('feed unavailable');
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || SITE_ORIGIN;
    const headers = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true }, { headers: { ...headers, 'Cache-Control': 'no-store' } });
    }
    const match = url.pathname.match(/^\/feed\/([ZVG])$/);
    if (!match) return new Response('Not found', { status: 404, headers });

    try {
      const xml = await fetchFeed(match[1]);
      return new Response(xml, {
        headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
      });
    } catch {
      return Response.json({ error: 'Feed unavailable' }, { status: 502, headers });
    }
  },
};
