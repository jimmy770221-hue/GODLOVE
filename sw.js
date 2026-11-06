// 展望系統模擬器：離線快取（有網路時優先抓最新版，沒網路時用上次存的版本）
const CACHE = 'zhanwang-sim-v8';
const FILES = ['./', './index.html', './reg.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// 網頁本體以「路徑」為準存快取（不含 ?v=… 之類的參數）；根目錄視同 index.html
function pageKey(url) {
  const u = new URL(url);
  let p = u.pathname;
  if (p.endsWith('/')) p += 'index.html';
  return u.origin + p;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate' || /\.html$|\/$/.test(new URL(req.url).pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const key = pageKey(req.url);
      try {
        const net = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))]);
        if (net && net.ok) cache.put(key, net.clone());
        return net;
      } catch (err) {
        return (await cache.match(key)) || (await cache.match(pageKey(new URL('./', req.url).href))) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
    return res;
  })));
});
