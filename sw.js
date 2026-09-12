/* Service Worker 自杀式兜底：本应用已改为纯网络加载（资源全内联，无需离线缓存），
 * 微信等内置浏览器对 SW 支持不稳曾导致"打不开 / 点不动"。任何加载此 sw.js 的环境都会：
 *   1) 安装时跳过等待；
 *   2) 激活时删除全部旧缓存并立即注销自身；
 *   3) fetch 全程走网络、不写缓存，永远拿到线上最新。
 * 配合 index.html 启动时主动 unregister 旧 SW，旧版 SW 缓存壳可彻底清除。 */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // 纯网络，不缓存：内联 HTML 本就无需缓存，离线能力不再依赖 SW
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('', { status: 504, statusText: 'offline' });
  }));
});
