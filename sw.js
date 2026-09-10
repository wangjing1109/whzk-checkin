/* Service Worker：装好后断网也能打开打卡
 * 关键策略（修复手机端"蓝块+空白+TAB 死"的白屏问题）：
 *  - install 时 skipWaiting，activate 时 clients.claim + 删除旧缓存，确保新版立即生效
 *  - HTML / JS / CSS / manifest 一律「网络优先」：只要联网就永远拿到最新且一致的一套文件，
 *    杜绝旧 SW 把"新 index.html + 旧 store.js"混合吐出导致页面崩溃
 *  - 图片/图标「缓存优先」：保证离线也能显示，并在后台静默更新
 *  - 离线时回落到缓存；导航离线回落首页，保证打不开时至少能进首页
 */
const VERSION = 'whzk-v2.1.0';
/* 说明：CSS/JS 已全部内联进 index.html，这里只缓存首页与图标。
   不再缓存 js/ 下的独立文件，避免旧脚本被缓存后与新版 HTML 混合导致页面崩溃。 */
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/3d/3d-banner.png',
  './icons/3d/3d-today.png',
  './icons/3d/3d-week.png',
  './icons/3d/3d-wrong.png',
  './icons/3d/3d-mood.png',
  './icons/3d/3d-me.png',
  './icons/3d/3d-pdf.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS).catch(err => {
        console.warn('缓存部分失败，改为逐个缓存', err);
        return Promise.all(ASSETS.map(u => c.add(u).catch(() => null)));
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isImage = /\.(png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(url.pathname);

  if (isImage) {
    // 图片：缓存优先，离线可用；后台顺手更新
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => {
          if (res && res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // HTML / JS / CSS / manifest：网络优先（永远拿线上最新一致的一套），离线回落缓存
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => {
      return caches.match(req).then(cached => {
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./index.html').then(c => c || caches.match('./'));
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
