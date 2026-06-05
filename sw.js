const CACHE = 'zombie-hangman-web-v1117';
const FILES = [
  './', './index.html', './style.css', './app.js', './manifest.json', './README.txt',
  './assets/data/hasla.js',
  './assets/img/bg_game_single.png',
  './assets/img/btn_menu_v1067.png',
  './assets/img/btn_menu_zombie_board.png',
  './assets/img/img_ratunek_v1098.png'
  ,'./assets/img/multiplayer_room.png',
  './assets/img/multiplayer_gallows.png',
  './assets/img/mp_room_chibi_background.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  const isHtml = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  const isFresh = isHtml || url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.search.includes('v=1117');

  if (isFresh) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy));
      return res;
    }))
  );
});
