'use strict';
const STORAGE = 'noqte.news.v1';
const NEWS_ENDPOINT = ['localhost', '127.0.0.1'].includes(location.hostname) ? '/api/news' : 'news.json';
const LIVE_API = 'https://boogeygame-news.m-a-hashempour.workers.dev';
const names = { Z: 'زومجی', V: 'ویجیاتو', G: 'گیمفا' };
const sourceBases = { Z: 'https://www.zoomg.ir', V: 'https://vigiato.net', G: 'https://gamefa.com' };
let state = { items: [], sources: {}, lastUpdate: null };
let storageWarning = false;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE));
  if (saved && Array.isArray(saved.items) && saved.sources && typeof saved.sources === 'object') state = saved;
} catch { storageWarning = true; }
let filter = 'all';
const $ = id => document.getElementById(id);
function httpURL(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function imageURL(value) {
  if (typeof value === 'string' && /^\/api\/image\/[a-f0-9]{64}$/.test(value)) return value;
  return httpURL(value);
}
function feedURL(value, base) {
  try { const url = new URL(value, base); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function imageFromHTML(value, base) {
  if (!value) return '';
  const document = new DOMParser().parseFromString(value, 'text/html');
  const image = document.querySelector('img');
  return feedURL(image?.dataset.src || image?.dataset.lazySrc || image?.dataset.original || image?.getAttribute('src') || '', base);
}
function parseFeed(xml, base) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('invalid feed');
  const entries = [...document.getElementsByTagName('*')].filter(node => ['item', 'entry'].includes(node.localName));
  const seen = new Set(); const items = [];
  for (const entry of entries) {
    let title = ''; let link = ''; let published = ''; let image = '';
    for (const node of entry.querySelectorAll('*')) {
      const tag = node.localName;
      if (tag === 'title' && !title) title = node.textContent.trim();
      else if (tag === 'link' && !link && (node.getAttribute('rel') || 'alternate') === 'alternate') link = node.getAttribute('href') || node.textContent;
      else if (['pubDate', 'published', 'updated'].includes(tag) && !published) published = node.textContent;
      if (['thumbnail', 'content', 'enclosure'].includes(tag)) {
        const candidate = node.getAttribute('url') || node.getAttribute('href') || node.getAttribute('src') || node.getAttribute('file') || '';
        if (candidate && (tag !== 'enclosure' || (node.getAttribute('type') || '').startsWith('image/'))) image ||= feedURL(candidate, base);
      }
      if (['description', 'encoded', 'content'].includes(tag) && !image) image = imageFromHTML(node.textContent, base);
    }
    link = feedURL(link.trim(), base);
    if (!title || !link || seen.has(link)) continue;
    seen.add(link); items.push({ id: link, url: link, title, image, published });
  }
  if (!items.length) throw new Error('empty feed');
  if (items.every(item => !Number.isNaN(Date.parse(item.published)))) items.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
  return items;
}
async function fetchLiveNews(signal) {
  const pairs = await Promise.all(Object.keys(names).map(async code => {
    try {
      const response = await fetch(`${LIVE_API}/feed/${code}?v=${Date.now()}`, { cache: 'no-store', signal });
      if (!response.ok) throw new Error('feed');
      return [code, { items: parseFeed(await response.text(), sourceBases[code]), error: null }];
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return [code, { items: [], error: `دریافت مطالب ${names[code]} ممکن نشد؛ دوباره تلاش کن.` }];
    }
  }));
  return Object.fromEntries(pairs);
}
function message(text, error = false) {
  const node = document.createElement('div'); node.className = 'notice' + (error ? ' error' : ''); node.textContent = text; $('messages').append(node);
}
function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
  catch { message('حافظهٔ مرورگر در دسترس نیست؛ فهرست با بستن صفحه ذخیره نمی‌شود.', true); }
}
function render() {
  const selected = state.items.filter(item => filter === 'all' || item.source === filter);
  $('articles').replaceChildren();
  for (const item of selected) {
    if (!httpURL(item.url) || !names[item.source]) continue;
    const card = document.createElement('article'); card.className = 'card';
    const letter = document.createElement('span'); letter.className = 'source-letter'; letter.textContent = item.source; letter.title = names[item.source];
    const link = document.createElement('a'); link.className = 'story-link'; link.href = httpURL(item.url); link.target = '_blank'; link.rel = 'noopener noreferrer';
    const imageWrap = document.createElement('div'); imageWrap.className = 'image-wrap';
    const fallback = () => { imageWrap.replaceChildren(); const mark = document.createElement('span'); mark.textContent = item.source; imageWrap.append(mark); };
    if (imageURL(item.image)) {
      const image = document.createElement('img'); image.src = imageURL(item.image); image.alt = item.title; image.loading = 'lazy'; image.addEventListener('error', fallback, { once: true }); imageWrap.append(image);
    } else fallback();
    const title = document.createElement('h2'); title.textContent = item.title;
    const meta = document.createElement('div'); meta.className = 'card-meta';
    const source = document.createElement('span'); source.textContent = names[item.source];
    const time = document.createElement('time'); const date = new Date(item.published);
    if (!Number.isNaN(date.getTime())) { time.dateTime = date.toISOString(); time.textContent = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date); }
    const storyCopy = document.createElement('div'); storyCopy.className = 'story-copy';
    meta.append(source, time); storyCopy.append(meta, title); link.append(imageWrap, storyCopy); card.append(letter, link); $('articles').append(card);
  }
  $('total').textContent = state.items.length.toLocaleString('fa-IR');
  $('empty').hidden = selected.length > 0;
  if (state.items.length && !selected.length) {
    $('empty').querySelector('h2').textContent = 'هنوز مطلبی از این منبع نداریم';
    $('empty').querySelector('p').textContent = 'منبع دیگری را انتخاب کن یا دوباره تازه‌ها را بگیر.';
  } else if (!state.items.length) {
    $('empty').querySelector('h2').textContent = 'یک رفرش تا تازه‌ترین‌ها';
    $('empty').querySelector('p').textContent = 'دکمهٔ بنفش را بزن؛ آخرین مطلب هر سه رسانه اینجا می‌آید. دفعه‌های بعد، مطالب جدید به این فهرست اضافه می‌شوند.';
  }
  if (state.lastUpdate) $('update-time').textContent = 'آخرین بررسی موفق: ' + new Date(state.lastUpdate).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}
// The first successful response establishes a separate baseline for each source.
// Retain all baseline IDs, but display only its newest item. Later refreshes add
// entries before the most recent known entry, avoiding old posts resurfacing.
function mergeSource(current, code, incoming) {
  if (!incoming.length) return 0;
  const previous = current.sources[code];
  const incomingById = new Map(incoming.map(item => [item.id, item]));
  // Refresh metadata for saved stories too. This replaces image URLs saved by
  // older versions with the current local image proxy URL.
  current.items = current.items.map(item => {
    const latest = item.source === code ? incomingById.get(item.id) : null;
    return latest ? { ...item, ...latest, source: code } : item;
  });
  let fresh;
  if (!previous) fresh = incoming.slice(0, 1);
  else {
    const known = new Set(previous.seen);
    const boundary = incoming.findIndex(item => known.has(item.id));
    const candidates = boundary < 0 ? incoming : incoming.slice(0, boundary);
    fresh = candidates.filter(item => !known.has(item.id));
  }
  const existing = new Set(current.items.map(item => item.source + ':' + item.id));
  fresh = fresh.filter(item => !existing.has(code + ':' + item.id));
  current.items.unshift(...fresh.map(item => ({ ...item, source: code })));
  current.sources[code] = { seen: [...new Set([...(previous?.seen || []), ...incoming.map(item => item.id)])] };
  return fresh.length;
}
async function refresh({ silent = false } = {}) {
  const button = $('refresh');
  if (!silent) {
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    $('refresh-label').textContent = 'در حال بررسی…'; $('messages').replaceChildren();
  }
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    let result;
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      const separator = NEWS_ENDPOINT.includes('?') ? '&' : '?';
      const response = await fetch(`${NEWS_ENDPOINT}${separator}v=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('server');
      result = await response.json();
    } else result = await fetchLiveNews(controller.signal);
    let added = 0; let success = 0;
    for (const code of Object.keys(names)) {
      const source = result[code];
      if (!source || source.error || !Array.isArray(source.items) || !source.items.length) {
        if (!silent) message(source?.error || `پاسخی از ${names[code]} دریافت نشد.`, true);
        continue;
      }
      const items = source.items.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && httpURL(item.url));
      if (!items.length) { if (!silent) message(`فهرست ${names[code]} قابل خواندن نیست.`, true); continue; }
      added += mergeSource(state, code, items); success++;
    }
    if (success) {
      state.items.sort((a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0));
      state.lastUpdate = new Date().toISOString(); persist(); render();
      if (added || !silent) message(added ? `${added.toLocaleString('fa-IR')} مطلب تازه به فهرست اضافه شد.` : 'بررسی شد؛ مطلب تازه‌ای منتشر نشده است.');
    }
  } catch (error) {
    if (!silent) message(error.name === 'AbortError' ? 'دریافت بیش از حد طول کشید؛ دوباره امتحان کن.' : 'دریافت خبرها ممکن نشد؛ اتصال اینترنت را بررسی کن و دوباره تلاش کن.', true);
  } finally {
    clearTimeout(timeout);
    if (!silent) {
      button.disabled = false; button.removeAttribute('aria-busy');
      $('refresh-label').textContent = 'تازه‌ها رو بگیر';
    }
  }
}
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
  render();
}));
$('refresh').addEventListener('click', () => refresh());
render();
if (storageWarning) message('ذخیرهٔ قبلی خوانده نشد؛ در این صفحه از فهرست تازه استفاده می‌شود.', true);
if (location.protocol === 'file:') message('برای دریافت خبرها، python3 server.py را اجرا کن و آدرس http://127.0.0.1:8765 را در مرورگر باز کن.', true);
else {
  refresh({ silent: true });
  setInterval(() => { if (!document.hidden) refresh({ silent: true }); }, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh({ silent: true }); });
}
