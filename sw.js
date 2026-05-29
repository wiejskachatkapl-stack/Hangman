const CACHE='zombie-hangman-web-v1034';
const FILES=['./','./index.html','./style.css','./app.js','./manifest.json','./favicon.png','./assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/apple-touch-icon.png','./assets/img/bg_menu_forest_gallows_2.png','./assets/img/menu_signpost.png','./assets/img/bg_game.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
