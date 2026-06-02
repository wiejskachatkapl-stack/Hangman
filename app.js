const VERSION = '1086';
const ALPHABET_ROWS = ['AĄBCĆDEĘFGHI'.split(''), 'JKLŁMNŃOÓPRS'.split(''), 'ŚTUWYZŹŻ'.split('')];
const ALPHABET = ALPHABET_ROWS.flat();
const FALLBACK_PHRASES = [
  {cat:'PAŃSTWO', text:'POLSKA'},
  {cat:'PAŃSTWO', text:'JAPONIA'},
  {cat:'PAŃSTWO', text:'TAJLANDIA'},
  {cat:'PAŃSTWO', text:'HISZPANIA'},
  {cat:'PAŃSTWO', text:'NORWEGIA'},
  {cat:'ZWIERZĘTA', text:'WILK'},
  {cat:'ZWIERZĘTA', text:'ŻÓŁW'},
  {cat:'ZWIERZĘTA', text:'NIETOPERZ'},
  {cat:'KUCHNIA', text:'PIEROGI'},
  {cat:'KUCHNIA', text:'ROSÓŁ'},
  {cat:'KUCHNIA', text:'ŻUREK'},
  {cat:'SPORT', text:'PIŁKA NOŻNA'},
  {cat:'SPORT', text:'KOSZYKÓWKA'},
  {cat:'KULTURA', text:'TEATR'},
  {cat:'MUZYKA', text:'GITARA'},
  {cat:'W DOMU', text:'LODÓWKA'},
  {cat:'ROŚLINY', text:'RÓŻA'}
];
function normalizePhrases(){
  const out=[];
  const simple = window.ZH_HASLA;
  if(simple && typeof simple === 'object' && !Array.isArray(simple)){
    Object.entries(simple).forEach(([cat, list])=>{
      if(Array.isArray(list)){
        list.forEach(text=>{
          if(text) out.push({cat:String(cat || 'HASŁO'), text:String(text).toUpperCase()});
        });
      }
    });
  }
  // Zgodność ze starszym formatem z wersji 1082.
  if(!out.length && Array.isArray(window.ZH_PHRASES)){
    window.ZH_PHRASES.forEach(p=>{
      if(p && p.text) out.push({cat:String(p.cat || 'HASŁO'), text:String(p.text).toUpperCase()});
    });
  }
  return out.length ? out : FALLBACK_PHRASES.map(p=>({cat:p.cat, text:p.text.toUpperCase()}));
}
const PHRASES = normalizePhrases();
let lastPhraseIndex = -1;

const START_LIFELINES = 2;
const MAX_AD_LIFELINES_PER_ZOMBIE = 3;
const ZOMBIES = ['Szmaciany','Pielęgniarka','Budowlaniec','Doktor','Klaun','Leśny'];
const STORE_KEY = 'zombieHangmanWebV1041';
let state = loadState();
let game = null;
let menuScale = Number(localStorage.getItem('zhMenuScale') || '1');
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function applyScale(){menuScale=clamp(menuScale,.72,1.18);document.documentElement.style.setProperty('--menu-scale', menuScale.toFixed(2));localStorage.setItem('zhMenuScale', String(menuScale));}
function loadState(){
  const base={score:0,zombiePoints:0,wins:0,losses:0,played:0,unlocked:1,lifelines:START_LIFELINES,adLifelinesUsed:0,z1086Migrated:false};
  try{
    const loaded={...base,...JSON.parse(localStorage.getItem(STORE_KEY)||'{}')};
    // Migracja z wcześniejszych wersji: startujemy z 2 kołami i limitem 3 reklam na jednego zombiaka.
    if(!loaded.z1086Migrated){
      loaded.lifelines=Math.min(Number(loaded.lifelines||0),START_LIFELINES);
      loaded.adLifelinesUsed=0;
      loaded.z1086Migrated=true;
      localStorage.setItem(STORE_KEY, JSON.stringify(loaded));
    }
    loaded.lifelines=clamp(Number(loaded.lifelines||0),0,START_LIFELINES);
    loaded.adLifelinesUsed=clamp(Number(loaded.adLifelinesUsed||0),0,MAX_AD_LIFELINES_PER_ZOMBIE);
    return loaded;
  }catch(e){return base}
}
function save(){localStorage.setItem(STORE_KEY, JSON.stringify(state));}
function $(id){return document.getElementById(id)}
function show(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $('screen-'+name).classList.add('active');
  if(name==='stats') renderStats();
  if(name==='gallery') renderGallery();
  if(name==='play-menu') requestAnimationFrame(updatePlayHotspots);
}
function newGame(){
  if(!PHRASES.length) return;
  let idx = Math.floor(Math.random()*PHRASES.length);
  if(PHRASES.length > 1 && idx === lastPhraseIndex){
    idx = (idx + 1 + Math.floor(Math.random()*(PHRASES.length-1))) % PHRASES.length;
  }
  lastPhraseIndex = idx;
  const item = PHRASES[idx];
  game={phrase:item.text.toUpperCase(),cat:item.cat,guessed:new Set(),mistakes:0,finished:false};
  show('game');
  renderKeyboard();
  renderGame('');
}
function renderKeyboard(){
  const box=$('keyboard');
  box.innerHTML='';
  ALPHABET_ROWS.forEach(row=>{
    const rowEl=document.createElement('div');
    rowEl.className='key-row';
    row.forEach(ch=>{
      const b=document.createElement('button');
      b.className='key';
      b.textContent=ch;
      b.onclick=()=>guess(ch);
      rowEl.appendChild(b);
    });
    box.appendChild(rowEl);
  });
}
function renderGame(msg){
  if(!game) return;
  $('category').textContent=game.cat;
  $('score').textContent=state.score;
  $('zombieMeter').textContent=`${state.zombiePoints}/300`;
  $('mistakes').textContent=`${game.mistakes}/6`;
  $('lifelinesLeft').textContent=state.lifelines;

  const word=$('word');
  word.innerHTML='';
  [...game.phrase].forEach(ch=>{
    const d=document.createElement('div');
    if(ch===' '){
      d.className='letter-box space';
      d.textContent='';
    } else {
      d.className='letter-box';
      d.textContent=game.guessed.has(ch)?ch:'';
    }
    word.appendChild(d);
  });

  $('message').textContent='';
  $('body').className='body-stage stage-'+Math.min(6,game.mistakes);

  document.querySelectorAll('.key').forEach(k=>{
    const ch=k.textContent;
    k.classList.remove('used','good','bad');
    if(game.guessed.has(ch)){
      k.classList.add('used');
      k.classList.add(game.phrase.includes(ch)?'good':'bad');
    }
  });

  document.querySelectorAll('.old-style-lifelines .life').forEach((btn, idx)=>{
    btn.classList.remove('life-used','life-hidden','life-add');
    btn.disabled = true;
    btn.dataset.action = 'hint';
    btn.setAttribute('aria-label', `Koło ratunkowe ${idx+1}`);

    if(game.finished){
      btn.classList.add('life-used');
      return;
    }

    // Normalnie w jednym zombiaku są tylko 2 koła ratunkowe.
    if(state.lifelines > 0){
      if(idx >= START_LIFELINES){
        btn.classList.add('life-hidden');
        return;
      }
      const active = idx < state.lifelines;
      btn.classList.toggle('life-used', !active);
      btn.disabled = !active;
      return;
    }

    // Po wykorzystaniu kół można 3 razy dodać jedno koło za reklamę.
    // Po trzeciej reklamie plus znika aż do nowego zombiaka.
    if(state.adLifelinesUsed < MAX_AD_LIFELINES_PER_ZOMBIE){
      if(idx === 0){
        btn.classList.add('life-add');
        btn.dataset.action = 'add-lifeline';
        btn.disabled = false;
        btn.setAttribute('aria-label', 'Dodaj jedno koło ratunkowe za reklamę');
      }else{
        btn.classList.add('life-hidden');
      }
    }else{
      btn.classList.add('life-hidden');
    }
  });
}
function guess(ch){if(!game || game.finished || game.guessed.has(ch)) return;game.guessed.add(ch);if(game.phrase.includes(ch)){const count=[...game.phrase].filter(x=>x===ch).length; state.score += 10*count; state.zombiePoints += 10*count;checkZombieUnlock();if(isWin()) return finish(true);renderGame(`Dobrze! Litera ${ch} występuje ${count}x.`);} else {game.mistakes++;if(game.mistakes>=6) return finish(false);renderGame(`Nie ma litery ${ch}.`);}save();}
function isWin(){return [...game.phrase].every(ch=>ch===' ' || game.guessed.has(ch));}
function finish(win){game.finished=true; state.played++;if(win){state.wins++; state.score+=50; state.zombiePoints+=50; checkZombieUnlock(); renderGame(''); save(); setTimeout(showWinPrompt, 220);}else {state.losses++; renderGame(`PRZEGRANA. Hasło: ${game.phrase}. Kliknij „Nowe hasło”.`); save();}}
function checkZombieUnlock(){while(state.zombiePoints>=300){state.zombiePoints-=300; state.unlocked=Math.min(ZOMBIES.length,state.unlocked+1); state.lifelines=START_LIFELINES; state.adLifelinesUsed=0;}}
function hint(){if(!game || game.finished) return;if(state.lifelines<=0){renderGame('Nie masz już kół ratunkowych.'); return;}const missing=[...new Set([...game.phrase].filter(ch=>ch!==' ' && !game.guessed.has(ch)))];if(!missing.length) return;const ch=missing[Math.floor(Math.random()*missing.length)];state.lifelines--; game.guessed.add(ch); state.score+=5; state.zombiePoints+=5; checkZombieUnlock();if(isWin()) finish(true); else renderGame(`Koło ratunkowe odkryło literę ${ch}.`);save();}
function addLifelineByAd(){if(!game || game.finished) return;if(state.lifelines>0) return;if(state.adLifelinesUsed>=MAX_AD_LIFELINES_PER_ZOMBIE){renderGame('Limit reklam dla tego zombiaka został wykorzystany.'); return;}alert('Tu będzie reklama. Po obejrzeniu dodano 1 koło ratunkowe.');state.adLifelinesUsed++;state.lifelines=1;save();renderGame('Dodano 1 koło ratunkowe.');}
function enterFullscreenByButton(){try{const el=document.documentElement;if(el.requestFullscreen) el.requestFullscreen();if(screen.orientation && screen.orientation.lock){screen.orientation.lock('landscape').catch(()=>{});}}catch(e){}}
function showWinPrompt(){
  const p = $('winPrompt');
  if(!p) return;
  p.classList.add('show');
  p.setAttribute('aria-hidden','false');
}
function hideWinPrompt(){
  const p = $('winPrompt');
  if(!p) return;
  p.classList.remove('show');
  p.setAttribute('aria-hidden','true');
}
function continueAfterWin(){
  // Po odgadnięciu hasła przycisk LOSUJ losuje od razu nowe hasło/kategorię,
  // bez przechodzenia do ekranu Losowanie kategorii.
  hideWinPrompt();
  newGame();
}
function backToMenuAfterWin(){
  hideWinPrompt();
  show('menu');
}

function renderStats(){$('statsBox').innerHTML=`<div>Wersja: <strong>${VERSION}</strong></div><div>Rozegrane partie: <strong>${state.played}</strong></div><div>Wygrane: <strong>${state.wins}</strong></div><div>Przegrane: <strong>${state.losses}</strong></div><div>Punkty: <strong>${state.score}</strong></div><div>Postęp zombie: <strong>${state.zombiePoints}/300</strong></div><div>Odblokowane zombie: <strong>${state.unlocked}/${ZOMBIES.length}</strong></div>`;}
function renderGallery(){const g=$('galleryBox'); g.innerHTML='';ZOMBIES.forEach((z,i)=>{const d=document.createElement('div'); d.className='zombie-card'; d.innerHTML=`${i<state.unlocked?'🧟':'🔒'}<span>${i<state.unlocked?z:'Zablokowany'}</span>`; g.appendChild(d);});}


// v1051: pola kliknięć ustawione bezpośrednio na napisach/deskach z grafiki bg_graj_integrated.png.
// Współrzędne są w pikselach oryginalnej grafiki 2048x1365, a funkcja niżej sama przelicza je
// dla telefonu i komputera przy background-size: cover.
const PLAY_BG_SIZE = { w: 2048, h: 1365 };
const PLAY_HOTSPOTS = {
  // v1055: współrzędne dopasowane do grafiki bg_graj_integrated.png.
  // To są piksele ORYGINALNEJ grafiki 2048x1365.
  // Funkcja updatePlayHotspots() sama przelicza je na ekran telefonu/komputera.
  single: { x: 60,  y: 390, w: 780, h: 165 },  // GRA POJEDYNCZA
  multi:  { x: 60,  y: 640, w: 790, h: 175 },  // MULTIPLAYER
  back:   { x: 115, y: 840, w: 560, h: 155 }   // COFNIJ
};
function placeHotspot(selector, box, rect, scale, ox, oy){
  const el = document.querySelector(selector);
  if(!el) return;
  el.style.left = `${ox + box.x * scale}px`;
  el.style.top = `${oy + box.y * scale}px`;
  el.style.width = `${box.w * scale}px`;
  el.style.height = `${box.h * scale}px`;
}
function updatePlayHotspots(){
  const screen = document.getElementById('screen-play-menu');
  if(!screen) return;
  const rect = screen.getBoundingClientRect();
  if(!rect.width || !rect.height) return;
  const scale = Math.max(rect.width / PLAY_BG_SIZE.w, rect.height / PLAY_BG_SIZE.h);
  const drawnW = PLAY_BG_SIZE.w * scale;
  const drawnH = PLAY_BG_SIZE.h * scale;
  const ox = (rect.width - drawnW) / 2;
  const oy = (rect.height - drawnH) / 2;
  placeHotspot('.play-bg-hotspot-single', PLAY_HOTSPOTS.single, rect, scale, ox, oy);
  placeHotspot('.play-bg-hotspot-multi', PLAY_HOTSPOTS.multi, rect, scale, ox, oy);
  placeHotspot('.play-bg-hotspot-back', PLAY_HOTSPOTS.back, rect, scale, ox, oy);
}
window.addEventListener('resize', updatePlayHotspots);
window.addEventListener('orientationchange', () => setTimeout(updatePlayHotspots, 150));
window.addEventListener('load', () => {
  updatePlayHotspots();
  setTimeout(updatePlayHotspots, 100);
  setTimeout(updatePlayHotspots, 300);
  setTimeout(updatePlayHotspots, 800);
});


function showFullscreenPrompt(){
  const p = $('fullscreenPrompt');
  if(!p) return;
  p.classList.add('show');
  p.setAttribute('aria-hidden','false');
}
function hideFullscreenPrompt(){
  const p = $('fullscreenPrompt');
  if(!p) return;
  p.classList.remove('show');
  p.setAttribute('aria-hidden','true');
}
window.addEventListener('load', () => {
  setTimeout(showFullscreenPrompt, 450);
});

document.addEventListener('click', e=>{const action=e.target.closest('[data-action]')?.dataset.action; if(!action) return;if(action==='menu'||action==='play-back') show('menu');if(action==='play-menu') show('play-menu');if(action==='about') show('about');if(action==='stats') show('stats');if(action==='gallery') show('gallery');if(action==='settings') show('settings');if(action==='new-single') show('draw-category');if(action==='draw-category') newGame();if(action==='hint') hint();if(action==='add-lifeline') addLifelineByAd();if(action==='fullscreen') enterFullscreenByButton();if(action==='fullscreen-yes'){hideFullscreenPrompt();enterFullscreenByButton();}if(action==='fullscreen-no') hideFullscreenPrompt();if(action==='win-losuj') continueAfterWin();if(action==='win-menu') backToMenuAfterWin();if(action==='scale-down'){menuScale-=.06;applyScale();}if(action==='scale-up'){menuScale+=.06;applyScale();}if(action==='scale-reset'){menuScale=1;applyScale();}if(action==='dual-info') alert('Gra podwójna będzie przeniesiona w kolejnym etapie po ustabilizowaniu gry pojedynczej.');if(action==='exit') alert('W wersji webowej zamknij kartę przeglądarki albo wróć przyciskiem systemowym.');if(action==='reset-stats'){ if(confirm('Czy wyczyścić zapis i statystyki?')){localStorage.removeItem(STORE_KEY); state=loadState(); renderStats(); renderGallery();}}});
applyScale();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js?v=1086').catch(()=>{}));}

