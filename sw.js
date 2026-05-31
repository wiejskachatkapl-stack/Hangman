const CACHE='zombie-hangman-web-v1063';
const FILES=['./','./index.html','./style.css','./app.js','./manifest.json','./favicon.png','./assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/apple-touch-icon.png','./assets/img/bg_graj_integrated.png','./assets/ui/menu/btn_drogowskaz_graj.png','./assets/img/bg_menu_forest_gallows_2.png','./assets/img/menu_signpost.png','./assets/img/bg_game.png','./assets/img/bg_draw_category_v1055.png','./assets/img/bg_game_guess_v1055.png','./assets/img/btn_losuj.png','./assets/img/btn_cofnij_draw.png','./assets/img/img_ratunek.png','./assets/img/bg_game_single.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;
  const url=new URL(req.url);
  const isFresh = url.pathname.endsWith('.html') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.search.includes('v=1063');
  if(isFresh){
    e.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res;}).catch(()=>caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res;})));
});
