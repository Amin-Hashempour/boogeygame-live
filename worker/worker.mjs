// Only these three upstream feeds can be requested through this Worker.
const SOURCES = {
  Z: ['https://www.zoomg.ir/feed/', 'https://www.zoomg.ir/rss/'],
  V: ['https://vigiato.net/feed/'],
  G: ['https://gamefa.com/feed/'],
};
const SOURCE_HOSTS = { Z: 'zoomg.ir', V: 'vigiato.net', G: 'gamefa.com' };

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

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:["']([^"']*)["']|([^\\s>]+))`, 'i'));
  return match?.[1] || match?.[2] || '';
}

function articleURL(value, code) {
  try {
    const url = new URL(value);
    const host = SOURCE_HOSTS[code];
    return url.protocol === 'https:' && (url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url : null;
  } catch { return null; }
}

function pageImage(html, article) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const kind = attribute(tag, 'property') || attribute(tag, 'name');
    if (['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'].includes(kind.toLowerCase())) {
      const content = attribute(tag, 'content');
      if (content) return new URL(content, article);
    }
  }
  for (const tag of html.match(/<(?:link|img)\b[^>]*>/gi) || []) {
    if (tag.toLowerCase().startsWith('<link') && attribute(tag, 'rel') !== 'image_src') continue;
    const content = attribute(tag, 'href') || attribute(tag, 'data-src') || attribute(tag, 'data-lazy-src') || attribute(tag, 'src');
    if (content) return new URL(content, article);
  }
  return null;
}

async function fetchArticleImage(value, code) {
  const article = articleURL(value, code);
  if (!article) throw new Error('invalid article');
  const page = await fetch(article, {
    headers: { 'Accept': 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; BoogeyGameNews/1.0)' },
    cf: { cacheEverything: true, cacheTtl: 900 },
  });
  if (!page.ok || !(page.headers.get('Content-Type') || '').includes('text/html')) throw new Error('article unavailable');
  const imageURL = pageImage(await page.text(), article);
  if (!imageURL || imageURL.protocol !== 'https:') throw new Error('image missing');
  const image = await fetch(imageURL, {
    headers: { 'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8', 'Referer': article.href, 'User-Agent': 'Mozilla/5.0 (compatible; BoogeyGameNews/1.0)' },
    cf: { cacheEverything: true, cacheTtl: 3600 },
  });
  const type = image.headers.get('Content-Type') || '';
  if (!image.ok || !type.startsWith('image/')) throw new Error('image unavailable');
  return { body: image.body, type };
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
    const imageMatch = url.pathname.match(/^\/image\/([ZVG])$/);
    if (imageMatch) {
      try {
        const image = await fetchArticleImage(url.searchParams.get('url') || '', imageMatch[1]);
        return new Response(image.body, {
          headers: { ...headers, 'Content-Type': image.type, 'Cache-Control': 'public, max-age=3600' },
        });
      } catch {
        return new Response('Image unavailable', { status: 404, headers });
      }
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
