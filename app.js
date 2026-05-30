const VERSION = 'WEB v1035';
const ALPHABET = 'AĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWYZŹŻ'.split('');
const PHRASES = [
  {cat:'PAŃSTWO', text:'POLSKA'}, {cat:'PAŃSTWO', text:'JAPONIA'}, {cat:'PAŃSTWO', text:'TAJLANDIA'},
  {cat:'ZWIERZĘTA', text:'WILK'}, {cat:'ZWIERZĘTA', text:'ŻÓŁW'}, {cat:'ZWIERZĘTA', text:'NIETOPERZ'},
  {cat:'KUCHNIA', text:'PIEROGI'}, {cat:'KUCHNIA', text:'ROSÓŁ'}, {cat:'KUCHNIA', text:'ŻUREK'},
  {cat:'SPORT', text:'PIŁKA NOŻNA'}, {cat:'SPORT', text:'KOSZYKÓWKA'}, {cat:'KULTURA', text:'TEATR'},
  {cat:'MUZYKA', text:'GITARA'}, {cat:'W DOMU', text:'LODÓWKA'}, {cat:'ROŚLINY', text:'RÓŻA'}
];
const ZOMBIES = ['Szmaciany','Pielęgniarka','Budowlaniec','Doktor','Klaun','Leśny'];
const STORE_KEY = 'zombieHangmanWebV1035';
let state = loadState();
let game = null;
let menuScale = Number(localStorage.getItem('zhMenuScale') || '1');
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function applyScale(){menuScale=clamp(menuScale,.72,1.18);document.documentElement.style.setProperty('--menu-scale', menuScale.toFixed(2));localStorage.setItem('zhMenuScale', String(menuScale));}
function loadState(){const base={score:0,zombiePoints:0,wins:0,losses:0,played:0,unlocked:1,lifelines:3};try{return {...base,...JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}}catch(e){return base}}
function save(){localStorage.setItem(STORE_KEY, JSON.stringify(state));}
function $(id){return document.getElementById(id)}
function show(name){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$('screen-'+name).classList.add('active'); if(name==='stats') renderStats(); if(name==='gallery') renderGallery();}
function newGame(){const item=PHRASES[Math.floor(Math.random()*PHRASES.length)];game={phrase:item.text.toUpperCase(),cat:item.cat,guessed:new Set(),mistakes:0,finished:false};show('game');renderKeyboard();renderGame('Nowe hasło wylosowane. Powodzenia!');}
function renderKeyboard(){const box=$('keyboard'); box.innerHTML='';ALPHABET.forEach(ch=>{const b=document.createElement('button'); b.className='key'; b.textContent=ch; b.onclick=()=>guess(ch); box.appendChild(b);});}
function renderGame(msg){if(!game) return;$('category').textContent=game.cat; $('score').textContent=state.score; $('zombieMeter').textContent=`${state.zombiePoints}/300`; $('mistakes').textContent=`${game.mistakes}/6`; $('lifelinesLeft').textContent=state.lifelines;const word=$('word'); word.innerHTML='';[...game.phrase].forEach(ch=>{const d=document.createElement('div'); if(ch===' '){d.className='letter-box space'; d.textContent='';} else {d.className='letter-box'; d.textContent=game.guessed.has(ch)?ch:'';} word.appendChild(d);});$('message').textContent=msg || '';$('body').className='body-stage stage-'+Math.min(6,game.mistakes);document.querySelectorAll('.key').forEach(k=>{const ch=k.textContent; if(game.guessed.has(ch)){k.classList.add('used'); k.classList.add(game.phrase.includes(ch)?'good':'bad');}});}
function guess(ch){if(!game || game.finished || game.guessed.has(ch)) return;game.guessed.add(ch);if(game.phrase.includes(ch)){const count=[...game.phrase].filter(x=>x===ch).length; state.score += 10*count; state.zombiePoints += 10*count;checkZombieUnlock();if(isWin()) return finish(true);renderGame(`Dobrze! Litera ${ch} występuje ${count}x.`);} else {game.mistakes++;if(game.mistakes>=6) return finish(false);renderGame(`Nie ma litery ${ch}.`);}save();}
function isWin(){return [...game.phrase].every(ch=>ch===' ' || game.guessed.has(ch));}
function finish(win){game.finished=true; state.played++;if(win){state.wins++; state.score+=50; state.zombiePoints+=50; checkZombieUnlock(); renderGame('WYGRANA! +50 punktów. Kliknij „Nowe hasło”.');}else {state.losses++; renderGame(`PRZEGRANA. Hasło: ${game.phrase}. Kliknij „Nowe hasło”.`);}save();}
function checkZombieUnlock(){while(state.zombiePoints>=300){state.zombiePoints-=300; state.unlocked=Math.min(ZOMBIES.length,state.unlocked+1); state.lifelines=3;}}
function hint(){if(!game || game.finished) return;if(state.lifelines<=0){renderGame('Nie masz już kół ratunkowych.'); return;}const missing=[...new Set([...game.phrase].filter(ch=>ch!==' ' && !game.guessed.has(ch)))];if(!missing.length) return;const ch=missing[Math.floor(Math.random()*missing.length)];state.lifelines--; game.guessed.add(ch); state.score+=5; state.zombiePoints+=5; checkZombieUnlock();if(isWin()) finish(true); else renderGame(`Koło ratunkowe odkryło literę ${ch}.`);save();}
function renderStats(){$('statsBox').innerHTML=`<div>Wersja: <strong>${VERSION}</strong></div><div>Rozegrane partie: <strong>${state.played}</strong></div><div>Wygrane: <strong>${state.wins}</strong></div><div>Przegrane: <strong>${state.losses}</strong></div><div>Punkty: <strong>${state.score}</strong></div><div>Postęp zombie: <strong>${state.zombiePoints}/300</strong></div><div>Odblokowane zombie: <strong>${state.unlocked}/${ZOMBIES.length}</strong></div>`;}
function renderGallery(){const g=$('galleryBox'); g.innerHTML='';ZOMBIES.forEach((z,i)=>{const d=document.createElement('div'); d.className='zombie-card'; d.innerHTML=`${i<state.unlocked?'🧟':'🔒'}<span>${i<state.unlocked?z:'Zablokowany'}</span>`; g.appendChild(d);});}
document.addEventListener('click', e=>{const action=e.target.closest('[data-action]')?.dataset.action; if(!action) return;if(action==='menu') show('menu');if(action==='play-menu') show('play-menu');if(action==='about') show('about');if(action==='stats') show('stats');if(action==='gallery') show('gallery');if(action==='settings') show('settings');if(action==='new-single') newGame();if(action==='hint') hint();if(action==='scale-down'){menuScale-=.06;applyScale();}if(action==='scale-up'){menuScale+=.06;applyScale();}if(action==='scale-reset'){menuScale=1;applyScale();}if(action==='dual-info') alert('Gra podwójna będzie przeniesiona w kolejnym etapie po ustabilizowaniu gry pojedynczej.');if(action==='exit') alert('W wersji webowej zamknij kartę przeglądarki albo wróć przyciskiem systemowym.');if(action==='reset-stats'){ if(confirm('Czy wyczyścić zapis i statystyki?')){localStorage.removeItem(STORE_KEY); state=loadState(); renderStats(); renderGallery();}}});
applyScale();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}


// Próba uruchomienia pełnego ekranu po pierwszym dotknięciu/kliknięciu.
// W normalnej karcie przeglądarki pasek systemowy może zostać, ale po instalacji jako PWA ekran jest pełny.
(function(){
  let tried = false;
  async function enterGameFullscreen(){
    if(tried) return;
    tried = true;
    try{
      const el = document.documentElement;
      if(el.requestFullscreen) await el.requestFullscreen();
      if(screen.orientation && screen.orientation.lock){
        try{ await screen.orientation.lock('landscape'); }catch(e){}
      }
    }catch(e){}
  }
  window.addEventListener('pointerdown', enterGameFullscreen, {once:true, passive:true});
  window.addEventListener('touchstart', enterGameFullscreen, {once:true, passive:true});
})();
