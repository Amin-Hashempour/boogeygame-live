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
  console.log('PASS: Worker source allowlist, RSS response, CORS, health and unknown route');
} finally {
  globalThis.fetch = originalFetch;
}
