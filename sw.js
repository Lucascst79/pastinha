// Service worker da Pastinha: guarda o app no aparelho para abrir rápido e funcionar sem internet.
// A página (index.html) vem sempre da rede quando há conexão, então atualizações chegam sozinhas;
// as bibliotecas em vendor/ têm versão fixa e ficam no cache.
const CACHE = 'pastinha-v1';
const CORE = [
  './',
  'manifest.webmanifest',
  'vendor/pdf-lib.min.js',
  'vendor/pdf.min.js',
  'vendor/pdf.worker.min.js',
  'vendor/Sortable.min.js',
  'vendor/jszip.min.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/favicon-64.png',
];
const PAGE_TIMEOUT_MS = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Página: tenta a rede (com limite de tempo) e cai para a cópia guardada
  if (req.mode === 'navigate') {
    e.respondWith(pageFromNetwork(req));
    return;
  }
  // Fontes do Google: usa a guardada e atualiza em segundo plano
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  // Arquivos do próprio site: cache primeiro (inclui vendor/heic2any.min.js, guardado no primeiro uso)
  if (url.origin === self.location.origin) {
    e.respondWith(cacheFirst(req));
  }
});

async function pageFromNetwork(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), PAGE_TIMEOUT_MS)),
    ]);
    if (res.ok) cache.put('./', res.clone());
    return res;
  } catch {
    return (await cache.match('./')) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || fresh;
}
