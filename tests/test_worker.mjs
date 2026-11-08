import assert from 'node:assert/strict';
import worker from '../worker/worker.mjs';

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async url => {
    assert.equal(url, 'https://www.zoomg.ir/feed/');
    return new Response('<rss><channel><item><title>News</title></item></channel></rss>');
  };
  const response = await worker.fetch(new Request('https://worker.example/feed/Z', {
    headers: { Origin: 'https://amin-hashempour.github.io' },
  }));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<title>News<\/title>/);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://amin-hashempour.github.io');

  const unknown = await worker.fetch(new Request('https://worker.example/feed/X'));
  assert.equal(unknown.status, 404);

  const health = await worker.fetch(new Request('https://worker.example/health'));
  assert.deepEqual(await health.json(), { ok: true });

  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://www.zoomg.ir/article') {
      return new Response('<meta property="og:image" content="https://cdn.example/cover.jpg">', { headers: { 'Content-Type': 'text/html' } });
    }
    assert.equal(String(url), 'https://cdn.example/cover.jpg');
    assert.equal(options.headers.Referer, 'https://www.zoomg.ir/article');
    return new Response('image bytes', { headers: { 'Content-Type': 'image/jpeg' } });
  };
  const image = await worker.fetch(new Request('https://worker.example/image/Z?url=https%3A%2F%2Fwww.zoomg.ir%2Farticle'));
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('Content-Type'), 'image/jpeg');
  const blocked = await worker.fetch(new Request('https://worker.example/image/Z?url=https%3A%2F%2Fevil.example%2Farticle'));
  assert.equal(blocked.status, 404);
  console.log('PASS: Worker RSS, CORS, health, article allowlist and image proxy');
} finally {
  globalThis.fetch = originalFetch;
}
