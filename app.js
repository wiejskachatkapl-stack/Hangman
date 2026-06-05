const VERSION = '1118';
const ALPHABET_ROWS = ['AĄBCĆDEĘFGHI'.split(''), 'JKLŁMNŃOÓPRS'.split(''), 'ŚTUWYZŹŻ'.split('')];
const ALPHABET = ALPHABET_ROWS.flat();
const MP_ALPHABET_ROWS = ['AĄBCĆDEĘFGHI'.split(''), 'JKLŁMNŃOÓPQRS'.split(''), 'ŚTUVWXYZŹŻ'.split('')];
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
let multiplayerRoom = null;
let gameMode = 'single';
const MP_TURN_SECONDS = 10;
let mpTurnInterval = null;
let mpTurnDeadline = 0;
let mpTurnFeedbackTimeout = null;
const MP_FIREBASE_ROOT = 'rooms';
const MP_CLIENT_ID_KEY = 'zhMultiplayerClientId';
const mpClientId = (()=>{
  let id=sessionStorage.getItem(MP_CLIENT_ID_KEY);
  if(!id){id='web_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);sessionStorage.setItem(MP_CLIENT_ID_KEY,id);}
  return id;
})();
let mpRoomFirebaseRef = null;
let mpRoomFirebaseListener = null;
let mpApplyingFirebaseSnapshot = false;
function getFirebaseDb(){return window.firebase?.apps?.length ? window.firebase.database() : null;}
function firebaseServerTimestamp(){return window.firebase?.database?.ServerValue?.TIMESTAMP || Date.now();}
function multiplayerFirebaseReady(){return Boolean(getFirebaseDb());}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function applyScale(){menuScale=clamp(menuScale,.72,1.18);document.documentElement.style.setProperty('--menu-scale', menuScale.toFixed(2));localStorage.setItem('zhMenuScale', String(menuScale));}
function loadState(){
  const base={score:0,zombiePoints:0,wins:0,losses:0,played:0,unlocked:1,lifelines:START_LIFELINES,adLifelinesUsed:0,z1098Migrated:false};
  try{
    const loaded={...base,...JSON.parse(localStorage.getItem(STORE_KEY)||'{}')};
    // Migracja z wcześniejszych wersji: startujemy z 2 kołami i limitem 3 reklam na jednego zombiaka.
    if(!loaded.z1098Migrated){
      loaded.lifelines=Math.min(Number(loaded.lifelines||0),START_LIFELINES);
      loaded.adLifelinesUsed=0;
      loaded.z1098Migrated=true;
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
  const keepMultiplayerTimer=name==='multiplayer-room' && gameMode==='multiplayer' && game && !game.finished;
  if(name!=='game' && !keepMultiplayerTimer) stopMultiplayerTurnTimer();
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $('screen-'+name).classList.add('active');
  if(name==='stats') renderStats();
  if(name==='gallery') renderGallery();
  if(name==='play-menu') requestAnimationFrame(updatePlayHotspots);
  if(name==='multiplayer') requestAnimationFrame(prepareMultiplayerScreen);
  if(name==='multiplayer-room') requestAnimationFrame(renderMultiplayerRoom);
  if(name==='draw-category') requestAnimationFrame(prepareDrawCategoryScreen);
}
function setGameMode(mode){
  gameMode = mode === 'multiplayer' ? 'multiplayer' : 'single';
  document.body.dataset.gameMode = gameMode;
}
function prepareDrawCategoryScreen(){
  const title=document.querySelector('#screen-draw-category .draw-card h1');
  const back=document.querySelector('#screen-draw-category .draw-back-img-btn');
  if(title) title.textContent=gameMode==='multiplayer' ? 'LOSOWANIE KATEGORII – MULTIPLAYER' : 'LOSOWANIE KATEGORII';
  if(back) back.dataset.action='draw-back';
}
function newGame(){
  if(!PHRASES.length) return;
  let idx = Math.floor(Math.random()*PHRASES.length);
  if(PHRASES.length > 1 && idx === lastPhraseIndex){
    idx = (idx + 1 + Math.floor(Math.random()*(PHRASES.length-1))) % PHRASES.length;
  }
  lastPhraseIndex = idx;
  const item = PHRASES[idx];
  game={phrase:item.text.toUpperCase(),cat:item.cat,guessed:new Set(),mistakes:0,finished:false,mode:gameMode,turnIndex:0,turnSeconds:MP_TURN_SECONDS,turnDeadline:Date.now()+MP_TURN_SECONDS*1000,turnFails:[false,false],turnLocked:false};
  if(gameMode==='multiplayer' && multiplayerRoom){
    multiplayerRoom.status='Rozgrywka trwa';
    multiplayerRoom.round={category:item.cat, phrase:item.text.toUpperCase(), startedAt:Date.now()};
    (multiplayerRoom.players||[]).slice(0,2).forEach(player=>{
      player.errors=0;
      if(typeof player.playerPoints!=='number') player.playerPoints=0;
      if(typeof player.zombiePoints!=='number') player.zombiePoints=0;
    });
    state.lifelines=START_LIFELINES;
    state.adLifelinesUsed=0;
    saveMultiplayerRoom();
    show('multiplayer-room');
    renderMultiplayerRoom();
    startMultiplayerTurnTimer(true);
    return;
  }
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
function renderMultiplayerRoomKeyboard(){
  const box=$('mpRoomKeyboard');
  if(!box) return;
  box.innerHTML='';
  MP_ALPHABET_ROWS.forEach(row=>{
    const rowEl=document.createElement('div');
    rowEl.className='mp-preview-key-row';
    rowEl.style.setProperty('--mp-key-count',String(row.length));
    row.forEach(ch=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='mp-preview-key';
      b.textContent=ch;
      b.disabled=!game || game.finished || game.turnLocked || !isMyMultiplayerTurn();
      if(game?.guessed?.has(ch)){
        b.classList.add('used');
        b.classList.add(game.phrase.includes(ch)?'good':'bad');
        b.disabled=true;
      }
      b.addEventListener('click',()=>guess(ch));
      rowEl.appendChild(b);
    });
    box.appendChild(rowEl);
  });
}
function renderMultiplayerRoomGame(msg=''){
  const category=$('mpGameCategory');
  const word=$('mpGameWord');
  const help=$('mpLifelinesLeft');
  const message=$('mpRoomMessage');
  const playing=gameMode==='multiplayer' && game;
  document.querySelector('#screen-multiplayer-room')?.classList.toggle('mp-round-active',Boolean(playing && !game.finished));
  if(category) category.textContent=playing ? game.cat : '---';
  if(help) help.textContent=String(state.lifelines);
  if(message) message.textContent=msg || (playing ? (game.finished?'Runda zakończona.':'Wybierz literę.') : 'Kliknij „ROZPOCZNIJ GRĘ”, a następnie wylosuj kategorię.');
  if(word){
    if(!playing){
      word.textContent='_ _ _ _ _ _ _ _';
    }else{
      word.innerHTML='';
      [...game.phrase].forEach(ch=>{
        const d=document.createElement('span');
        d.className=ch===' ' ? 'mp-room-letter space' : 'mp-room-letter';
        d.textContent=ch===' ' ? '' : (game.guessed.has(ch) || game.finished ? ch : '—');
        word.appendChild(d);
      });
    }
  }
  document.querySelectorAll('#screen-multiplayer-room .mp-preview-life').forEach((btn,index)=>{
    btn.disabled=!playing || game.finished || state.lifelines<=index;
    btn.classList.toggle('life-used',!playing || state.lifelines<=index || game.finished);
  });
  renderMultiplayerRoomKeyboard();
  updateMultiplayerTurnUi();
}
function renderGame(msg){
  if(!game) return;
  if(gameMode==='multiplayer'){renderMultiplayerRoomGame(msg);return;}
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

  $('message').textContent=msg || '';
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
function getMultiplayerTurnCount(){
  return Math.max(1,Math.min(2,(multiplayerRoom?.players||[]).length || 1));
}
function getMultiplayerTurnPlayer(index){
  return (multiplayerRoom?.players||[])[index] || null;
}
function getMyMultiplayerPlayerIndex(){
  return (multiplayerRoom?.players||[]).findIndex(player=>player.id===mpClientId);
}
function isMyMultiplayerTurn(){
  if(gameMode!=='multiplayer' || !game || game.finished) return false;
  return getMyMultiplayerPlayerIndex()===game.turnIndex;
}
function ensureMultiplayerTurnState(){
  if(!game) return;
  if(!Number.isInteger(game.turnIndex)) game.turnIndex=0;
  if(!Array.isArray(game.turnFails)) game.turnFails=[false,false];
  if(typeof game.turnSeconds!=='number') game.turnSeconds=MP_TURN_SECONDS;
  if(typeof game.turnLocked!=='boolean') game.turnLocked=false;
  if(typeof game.turnDeadline!=='number') game.turnDeadline=Date.now()+MP_TURN_SECONDS*1000;
}
function stopMultiplayerTurnTimer(){
  if(mpTurnInterval){clearInterval(mpTurnInterval);mpTurnInterval=null;}
  mpTurnDeadline=0;
}
function updateMultiplayerTurnUi(){
  const players=(multiplayerRoom?.players||[]).slice(0,2);
  const running=gameMode==='multiplayer' && game && !game.finished;
  ensureMultiplayerTurnState();
  [0,1].forEach(index=>{
    const number=index+1;
    const player=players[index];
    const active=Boolean(running && game.turnIndex===index && !game.turnLocked);
    const failed=Boolean(running && game.turnFails?.[index]);
    const seconds=running ? Math.max(0,Number(game.turnSeconds||0)) : MP_TURN_SECONDS;
    const nameText=player?.nick || (index===0?'GRACZ 1':'OCZEKIWANIE NA GRACZA 2');

    [`mpDuelPlayer${number}Name`,`mpGamePlayer${number}Name`].forEach(id=>{const el=$(id);if(el)el.textContent=nameText;});
    [`mpDuelPlayer${number}Timer`,`mpGamePlayer${number}Timer`].forEach(id=>{
      const el=$(id);if(!el)return;el.textContent=String(seconds);el.hidden=failed;el.setAttribute('aria-hidden',failed?'true':'false');
    });
    [`mpDuelPlayer${number}Fail`,`mpGamePlayer${number}Fail`].forEach(id=>{
      const el=$(id);if(!el)return;el.hidden=!failed;el.setAttribute('aria-hidden',failed?'false':'true');
    });
    [`mpDuelPlayer${number}Card`,`mpGamePlayer${number}Card`,`mpPlayerListRow${number}`].forEach(id=>{
      const el=$(id);if(!el)return;
      el.classList.toggle('mp-turn-active',active);
      el.classList.toggle('mp-turn-inactive',Boolean(running && !active));
      el.classList.toggle('mp-turn-failed',failed);
    });
  });
}
function startMultiplayerTurnTimer(resetSeconds=true){
  stopMultiplayerTurnTimer();
  if(gameMode!=='multiplayer' || !game || game.finished) return;
  ensureMultiplayerTurnState();
  if(resetSeconds){
    game.turnSeconds=MP_TURN_SECONDS;
    game.turnDeadline=Date.now()+MP_TURN_SECONDS*1000;
    game.turnLocked=false;
    game.turnFails=[false,false];
    saveMultiplayerRoom();
  }
  mpTurnDeadline=Number(game.turnDeadline||Date.now()+Math.max(1,game.turnSeconds)*1000);
  updateMultiplayerTurnUi();
  mpTurnInterval=setInterval(()=>{
    if(gameMode!=='multiplayer' || !game || game.finished){stopMultiplayerTurnTimer();return;}
    const left=Math.max(0,Math.ceil((Number(game.turnDeadline||mpTurnDeadline)-Date.now())/1000));
    if(left!==game.turnSeconds){game.turnSeconds=left;updateMultiplayerTurnUi();}
    if(left<=0 && multiplayerRoom?.isHost) failMultiplayerTurn('Czas minął — kolej następnego gracza.');
  },200);
}
function switchMultiplayerTurn(){
  if(!game || game.finished) return;
  const count=getMultiplayerTurnCount();
  game.turnIndex=(game.turnIndex+1)%count;
  game.turnFails=[false,false];
  game.turnLocked=false;
  startMultiplayerTurnTimer(true);
  renderGame('Kolej następnego gracza.');
}
function failMultiplayerTurn(message){
  if(gameMode!=='multiplayer' || !game || game.finished || game.turnLocked) return;
  ensureMultiplayerTurnState();
  stopMultiplayerTurnTimer();
  game.turnLocked=true;
  game.turnSeconds=0;
  game.turnDeadline=Date.now();
  game.turnFails=[false,false];
  game.turnFails[game.turnIndex]=true;
  game.mistakes++;
  const player=getMultiplayerTurnPlayer(game.turnIndex);
  if(player) player.errors=Number(player.errors||0)+1;
  saveMultiplayerRoom();
  renderGame(message);
  renderMultiplayerRoom();
  updateMultiplayerTurnUi();
  if(game.mistakes>=6){
    if(mpTurnFeedbackTimeout) clearTimeout(mpTurnFeedbackTimeout);
    mpTurnFeedbackTimeout=setTimeout(()=>finish(false),700);
    return;
  }
  if(mpTurnFeedbackTimeout) clearTimeout(mpTurnFeedbackTimeout);
  mpTurnFeedbackTimeout=setTimeout(switchMultiplayerTurn,850);
}
function registerCorrectMultiplayerGuess(count){
  const player=getMultiplayerTurnPlayer(game.turnIndex);
  if(player){
    player.playerPoints=Number(player.playerPoints||0)+(10*count);
    player.zombiePoints=Number(player.zombiePoints||0)+(10*count);
  }
  saveMultiplayerRoom();
  renderMultiplayerRoom();
  startMultiplayerTurnTimer(true);
}
function guess(ch){
  if(!game || game.finished || game.turnLocked) return;
  if(gameMode==='multiplayer' && !isMyMultiplayerTurn()){renderGame('Teraz gra drugi gracz.');return;}
  if(game.guessed.has(ch)){
    if(gameMode==='multiplayer') failMultiplayerTurn(`Litera ${ch} była już użyta — kolej następnego gracza.`);
    return;
  }
  game.guessed.add(ch);
  if(game.phrase.includes(ch)){
    const count=[...game.phrase].filter(x=>x===ch).length;
    state.score += 10*count;
    state.zombiePoints += 10*count;
    checkZombieUnlock();
    if(gameMode==='multiplayer') registerCorrectMultiplayerGuess(count);
    if(isWin()) return finish(true);
    renderGame(`Dobrze! Litera ${ch} występuje ${count}x. Gracz zachowuje kolej.`);
  } else {
    if(gameMode==='multiplayer') return failMultiplayerTurn(`Nie ma litery ${ch} — kolej następnego gracza.`);
    game.mistakes++;
    if(game.mistakes>=6) return finish(false);
    renderGame(`Nie ma litery ${ch}.`);
  }
  save();
}
function isWin(){return [...game.phrase].every(ch=>ch===' ' || game.guessed.has(ch));}
function finish(win){
  stopMultiplayerTurnTimer();
  if(mpTurnFeedbackTimeout){clearTimeout(mpTurnFeedbackTimeout);mpTurnFeedbackTimeout=null;}
  game.finished=true;
  updateMultiplayerTurnUi();
  state.played++;
  if(gameMode==='multiplayer' && multiplayerRoom){
    multiplayerRoom.status=win?'Hasło odgadnięte':'Runda przegrana';
    multiplayerRoom.lastResult={win,phrase:game.phrase,category:game.cat,finishedAt:Date.now()};
    saveMultiplayerRoom();
  }
  if(win){
    state.wins++; state.score+=50; state.zombiePoints+=50; checkZombieUnlock();
    if(gameMode==='multiplayer'){
      const player=getMultiplayerTurnPlayer(game.turnIndex);
      if(player){player.playerPoints=Number(player.playerPoints||0)+50;player.zombiePoints=Number(player.zombiePoints||0)+50;}
      saveMultiplayerRoom();
    }
    renderGame('Hasło odgadnięte!'); save(); setTimeout(showWinPrompt, 220);
  }else{
    state.losses++; renderGame(`PRZEGRANA. Hasło: ${game.phrase}.`); save();
  }
}
function checkZombieUnlock(){while(state.zombiePoints>=300){state.zombiePoints-=300; state.unlocked=Math.min(ZOMBIES.length,state.unlocked+1); state.lifelines=START_LIFELINES; state.adLifelinesUsed=0;}}
function hint(){
  if(!game || game.finished) return;
  if(gameMode==='multiplayer' && !isMyMultiplayerTurn()){renderGame('Teraz gra drugi gracz.');return;}
  if(state.lifelines<=0){renderGame('Nie masz już kół ratunkowych.');return;}
  const missing=[...new Set([...game.phrase].filter(ch=>ch!==' ' && !game.guessed.has(ch)))];
  if(!missing.length) return;
  const ch=missing[Math.floor(Math.random()*missing.length)];
  state.lifelines--;
  game.guessed.add(ch);
  state.score+=5;
  state.zombiePoints+=5;
  checkZombieUnlock();
  if(gameMode==='multiplayer'){
    const player=getMultiplayerTurnPlayer(game.turnIndex);
    if(player){player.playerPoints=Number(player.playerPoints||0)+5;player.zombiePoints=Number(player.zombiePoints||0)+5;}
    saveMultiplayerRoom();
    startMultiplayerTurnTimer(true);
  }
  if(isWin()) finish(true); else renderGame(`Koło ratunkowe odkryło literę ${ch}.`);
  save();
}
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
  hideWinPrompt();
  if(gameMode==='multiplayer'){
    if(multiplayerRoom){
      multiplayerRoom.status='Losowanie nowej kategorii';
      saveMultiplayerRoom();
    }
    show('draw-category');
    return;
  }
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


function getMultiplayerNick(){
  return (document.getElementById('multiplayerNick')?.value || '').trim();
}
function setMultiplayerStatus(text, type='info'){
  const box=document.getElementById('multiplayerStatus');
  if(!box) return;
  box.textContent=text;
  box.dataset.type=type;
}
function makeRoomCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='';
  for(let i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}
function normalizeFirebasePlayers(playersData){
  return Object.entries(playersData||{}).map(([id,p])=>({id,...p})).sort((a,b)=>Number(a.joinedAt||0)-Number(b.joinedAt||0)).slice(0,2);
}
function serializeMultiplayerRound(){
  if(gameMode!=='multiplayer' || !game) return multiplayerRoom?.round || null;
  const guessed={};
  game.guessed.forEach(ch=>{guessed[ch]=true;});
  return {
    active:!game.finished,
    category:game.cat,
    phrase:game.phrase,
    guessed,
    mistakes:Number(game.mistakes||0),
    finished:Boolean(game.finished),
    turnIndex:Number(game.turnIndex||0),
    turnSeconds:Number(game.turnSeconds||0),
    turnDeadline:Number(game.turnDeadline||Date.now()),
    turnFails:Array.isArray(game.turnFails)?game.turnFails:[false,false],
    turnLocked:Boolean(game.turnLocked),
    lifelines:Number(state.lifelines||0),
    updatedAt:firebaseServerTimestamp()
  };
}
function saveLocalMultiplayerRoom(){
  if(multiplayerRoom){
    localStorage.setItem('zhCurrentMultiplayerRoom',JSON.stringify({code:multiplayerRoom.code,me:multiplayerRoom.me,myId:mpClientId,isHost:multiplayerRoom.isHost}));
  }else localStorage.removeItem('zhCurrentMultiplayerRoom');
}
function saveMultiplayerRoom(){
  saveLocalMultiplayerRoom();
  if(!multiplayerRoom || mpApplyingFirebaseSnapshot) return;
  const db=getFirebaseDb();
  if(!db) return;
  const code=multiplayerRoom.code;
  const roomRef=db.ref(`${MP_FIREBASE_ROOT}/${code}`);
  const updateData={
    code,
    host:multiplayerRoom.host||'',
    hostId:multiplayerRoom.hostId||((multiplayerRoom.isHost)?mpClientId:''),
    status:multiplayerRoom.status||'Oczekiwanie na graczy',
    round:serializeMultiplayerRound(),
    lastResult:multiplayerRoom.lastResult||null,
    updatedAt:firebaseServerTimestamp()
  };
  roomRef.update(updateData).catch(err=>setMultiplayerStatus(`Błąd synchronizacji: ${err.message}`,'error'));
  (multiplayerRoom.players||[]).forEach(player=>{
    if(!player.id) return;
    db.ref(`${MP_FIREBASE_ROOT}/${code}/players/${player.id}`).update({
      nick:player.nick||'Gracz',role:player.role||'GRACZ',playerPoints:Number(player.playerPoints||0),zombiePoints:Number(player.zombiePoints||0),errors:Number(player.errors||0),joinedAt:Number(player.joinedAt||Date.now())
    }).catch(()=>{});
  });
}
function loadMultiplayerRoom(){
  try{return JSON.parse(localStorage.getItem('zhCurrentMultiplayerRoom')||'null')}catch(e){return null}
}
function detachFirebaseRoomListener(){
  if(mpRoomFirebaseRef && mpRoomFirebaseListener) mpRoomFirebaseRef.off('value',mpRoomFirebaseListener);
  mpRoomFirebaseRef=null;mpRoomFirebaseListener=null;
}
function applyFirebaseRound(remoteRound){
  if(!remoteRound || !remoteRound.phrase) return;
  const remoteGuessed=new Set(Object.keys(remoteRound.guessed||{}));
  game={
    phrase:String(remoteRound.phrase||'').toUpperCase(),
    cat:String(remoteRound.category||'HASŁO'),
    guessed:remoteGuessed,
    mistakes:Number(remoteRound.mistakes||0),
    finished:Boolean(remoteRound.finished),
    mode:'multiplayer',
    turnIndex:Number(remoteRound.turnIndex||0),
    turnSeconds:Number(remoteRound.turnSeconds??MP_TURN_SECONDS),
    turnDeadline:Number(remoteRound.turnDeadline||Date.now()+MP_TURN_SECONDS*1000),
    turnFails:Array.isArray(remoteRound.turnFails)?remoteRound.turnFails:[false,false],
    turnLocked:Boolean(remoteRound.turnLocked)
  };
  state.lifelines=Number(remoteRound.lifelines??state.lifelines);
  setGameMode('multiplayer');
  if(!game.finished) startMultiplayerTurnTimer(false); else stopMultiplayerTurnTimer();
}
function subscribeToFirebaseRoom(code){
  const db=getFirebaseDb();
  if(!db){setMultiplayerStatus('Firebase nie został uruchomiony. Odśwież stronę.','error');return;}
  detachFirebaseRoomListener();
  mpRoomFirebaseRef=db.ref(`${MP_FIREBASE_ROOT}/${code}`);
  mpRoomFirebaseListener=snapshot=>{
    const raw=snapshot.val();
    if(!raw){
      detachFirebaseRoomListener();
      multiplayerRoom=null;game=null;saveLocalMultiplayerRoom();
      show('multiplayer');setMultiplayerStatus('Pokój nie istnieje albo został zamknięty.','error');return;
    }
    mpApplyingFirebaseSnapshot=true;
    const players=normalizeFirebasePlayers(raw.players);
    multiplayerRoom={...raw,code,players,myId:mpClientId,me:players.find(p=>p.id===mpClientId)?.nick||localStorage.getItem('zhMultiplayerNick')||'',isHost:raw.hostId===mpClientId};
    saveLocalMultiplayerRoom();
    if(raw.round?.phrase) applyFirebaseRound(raw.round);
    else if(raw.status!=='Rozgrywka trwa'){game=null;stopMultiplayerTurnTimer();}
    mpApplyingFirebaseSnapshot=false;
    if(raw.round?.phrase && !document.getElementById('screen-multiplayer-room')?.classList.contains('active')) show('multiplayer-room');
    else renderMultiplayerRoom();
  };
  mpRoomFirebaseRef.on('value',mpRoomFirebaseListener,err=>setMultiplayerStatus(`Brak dostępu do bazy: ${err.message}`,'error'));
}
function enterMultiplayerRoom(room){
  multiplayerRoom=room;
  saveLocalMultiplayerRoom();
  subscribeToFirebaseRoom(room.code);
  show('multiplayer-room');
}
async function createMultiplayerRoom(){
  const nick=getMultiplayerNick();
  if(!nick){setMultiplayerStatus('Wpisz nick, aby utworzyć pokój.','error');return;}
  const db=getFirebaseDb();
  if(!db){setMultiplayerStatus('Brak połączenia z Firebase. Odśwież stronę.','error');return;}
  localStorage.setItem('zhMultiplayerNick',nick);
  setMultiplayerStatus('Tworzenie pokoju...','info');
  for(let attempt=0;attempt<5;attempt++){
    const code=makeRoomCode();
    const roomRef=db.ref(`${MP_FIREBASE_ROOT}/${code}`);
    const player={nick,role:'HOST',playerPoints:0,zombiePoints:0,errors:0,joinedAt:Date.now()};
    const room={code,host:nick,hostId:mpClientId,status:'Oczekiwanie na graczy',createdAt:firebaseServerTimestamp(),updatedAt:firebaseServerTimestamp(),players:{[mpClientId]:player},round:null};
    const result=await roomRef.transaction(current=>current===null?room:undefined).catch(()=>null);
    if(result?.committed){
      roomRef.child(`players/${mpClientId}`).onDisconnect().remove();
      const input=document.getElementById('multiplayerRoomCode');if(input) input.value=code;
      enterMultiplayerRoom({...room,players:[{id:mpClientId,...player}],me:nick,isHost:true});
      return;
    }
  }
  setMultiplayerStatus('Nie udało się utworzyć pokoju. Spróbuj ponownie.','error');
}
async function joinMultiplayerRoom(){
  const nick=getMultiplayerNick();
  const code=(document.getElementById('multiplayerRoomCode')?.value || '').trim().toUpperCase();
  if(!nick){setMultiplayerStatus('Wpisz nick, aby dołączyć do pokoju.','error');return;}
  if(code.length<4){setMultiplayerStatus('Wpisz prawidłowy kod pokoju.','error');return;}
  const db=getFirebaseDb();
  if(!db){setMultiplayerStatus('Brak połączenia z Firebase. Odśwież stronę.','error');return;}
  setMultiplayerStatus('Dołączanie do pokoju...','info');
  const roomRef=db.ref(`${MP_FIREBASE_ROOT}/${code}`);
  const snap=await roomRef.once('value').catch(()=>null);
  if(!snap?.exists()){setMultiplayerStatus('Nie znaleziono pokoju o takim kodzie.','error');return;}
  const raw=snap.val();
  const currentPlayers=normalizeFirebasePlayers(raw.players);
  if(currentPlayers.length>=2 && !currentPlayers.some(p=>p.id===mpClientId)){setMultiplayerStatus('Ten pokój ma już dwóch graczy.','error');return;}
  localStorage.setItem('zhMultiplayerNick',nick);
  const player={nick,role:'GRACZ',playerPoints:0,zombiePoints:0,errors:0,joinedAt:Date.now()};
  await roomRef.child(`players/${mpClientId}`).set(player);
  roomRef.child(`players/${mpClientId}`).onDisconnect().remove();
  await roomRef.update({status:'Dwóch graczy w pokoju',updatedAt:firebaseServerTimestamp()});
  enterMultiplayerRoom({...raw,code,players:[...currentPlayers.filter(p=>p.id!==mpClientId),{id:mpClientId,...player}],me:nick,isHost:false});
}
function prepareMultiplayerScreen(){
  const nick=document.getElementById('multiplayerNick');
  if(nick && !nick.value) nick.value=localStorage.getItem('zhMultiplayerNick') || '';
  setMultiplayerStatus(multiplayerFirebaseReady()?'':'Łączenie z Firebase...');
}
function renderMultiplayerRoom(){
  if(!multiplayerRoom) multiplayerRoom=loadMultiplayerRoom();
  if(!multiplayerRoom){show('multiplayer');return;}
  if(!multiplayerRoom.players && multiplayerRoom.code){subscribeToFirebaseRoom(multiplayerRoom.code);return;}
  const code=document.getElementById('mpRoomCodeView');
  const title=document.getElementById('mpRoomTitle');
  const host=document.getElementById('mpHostName');
  const status=document.getElementById('mpRoomStatusText');
  const list=document.getElementById('mpPlayersList');
  const gameInfo=document.getElementById('mpRoomGameInfo');
  if(code) code.textContent=multiplayerRoom.code || '------';
  if(title) title.textContent=multiplayerRoom.isHost ? 'Twój pokój' : 'Pokój gracza';
  if(host) host.textContent=multiplayerRoom.host || '---';
  if(status) status.textContent=multiplayerRoom.status || 'Oczekiwanie na graczy';
  if(gameInfo){
    const round=multiplayerRoom.round;
    gameInfo.innerHTML=round
      ? `<strong>Ostatnia kategoria:</strong> ${round.category}<br><span>Rozgrywka jest synchronizowana między graczami.</span>`
      : 'Host rozpoczyna grę, następnie losuje kategorię i obaj gracze przechodzą do wspólnej planszy odgadywania.';
  }
  if(list){
    list.innerHTML='';
    (multiplayerRoom.players||[]).forEach((player,index)=>{
      const row=document.createElement('div');
      row.className='mp-player-row';
      row.id=`mpPlayerListRow${index+1}`;
      row.innerHTML=`<span class="mp-player-number">${index+1}</span><strong>${player.nick}</strong><span class="mp-player-role">${player.role||'GRACZ'}</span><span class="mp-player-online" title="Online"></span>`;
      list.appendChild(row);
    });
  }
  const duelPlayers=(multiplayerRoom.players||[]).slice(0,2);
  [0,1].forEach(index=>{
    const player=duelPlayers[index];
    const number=index+1;
    const name=document.getElementById(`mpDuelPlayer${number}Name`);
    const points=document.getElementById(`mpDuelPlayer${number}Points`);
    const zombiePoints=document.getElementById(`mpDuelPlayer${number}ZombiePoints`);
    const errors=document.getElementById(`mpDuelPlayer${number}Errors`);
    if(name) name.textContent=player?.nick || (index===0 ? 'GRACZ 1' : 'OCZEKIWANIE NA GRACZA 2');
    if(points) points.textContent=String(player?.playerPoints ?? 0);
    if(zombiePoints) zombiePoints.textContent=`${player?.zombiePoints ?? 0}/300`;
    if(errors) errors.textContent=`${player?.errors ?? 0}/6`;
  });
  const startBtn=document.querySelector('[data-action="mp-start-game"]');
  if(startBtn){
    const roundActive=gameMode==='multiplayer' && game && !game.finished;
    const hasTwoPlayers=(multiplayerRoom.players||[]).length>=2;
    startBtn.disabled=!multiplayerRoom.isHost || roundActive || !hasTwoPlayers;
    startBtn.classList.toggle('locked',startBtn.disabled);
    startBtn.textContent=roundActive?'GRA TRWA':(!hasTwoPlayers?'OCZEKIWANIE NA GRACZA':(multiplayerRoom.isHost?'ROZPOCZNIJ GRĘ':'OCZEKIWANIE NA HOSTA'));
  }
  renderMultiplayerRoomGame();
}
async function leaveMultiplayerRoom(){
  stopMultiplayerTurnTimer();
  const db=getFirebaseDb();
  const room=multiplayerRoom;
  detachFirebaseRoomListener();
  if(db && room?.code){
    if(room.isHost) await db.ref(`${MP_FIREBASE_ROOT}/${room.code}`).remove().catch(()=>{});
    else await db.ref(`${MP_FIREBASE_ROOT}/${room.code}/players/${mpClientId}`).remove().catch(()=>{});
  }
  setGameMode('single');multiplayerRoom=null;game=null;saveLocalMultiplayerRoom();show('multiplayer');setMultiplayerStatus('Opuszczono pokój.','ok');
}
function startMultiplayerGame(){
  if(!multiplayerRoom || !multiplayerRoom.isHost || (multiplayerRoom.players||[]).length<2) return;
  setGameMode('multiplayer');
  game=null;
  multiplayerRoom.status='Losowanie kategorii';
  multiplayerRoom.round=null;
  saveMultiplayerRoom();
  show('draw-category');
}
function drawBack(){
  if(gameMode==='multiplayer' && multiplayerRoom) show('multiplayer-room');
  else show('play-menu');
}
function gameMenu(){
  if(gameMode==='multiplayer' && multiplayerRoom) show('multiplayer-room');
  else show('menu');
}

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
function isPhoneDevice(){
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|iPhone|iPod|Mobile|Windows Phone|Opera Mini|IEMobile/i.test(ua);
  const smallTouchScreen = (navigator.maxTouchPoints || 0) > 0 && Math.min(window.screen.width, window.screen.height) <= 900;
  return mobileUa || smallTouchScreen;
}

window.addEventListener('load', () => {
  if (isPhoneDevice()) {
    hideFullscreenPrompt();
    return;
  }
  setTimeout(showFullscreenPrompt, 450);
});

document.addEventListener('click', e=>{
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(!action) return;
  if(action==='menu'){
    if(e.target.closest('#screen-game')) gameMenu();
    else show('menu');
  }
  if(action==='play-back') show('menu');
  if(action==='play-menu') show('play-menu');
  if(action==='about') show('about');
  if(action==='stats') show('stats');
  if(action==='gallery') show('gallery');
  if(action==='settings') show('settings');
  if(action==='new-single'){setGameMode('single');show('draw-category');}
  if(action==='draw-category') newGame();
  if(action==='draw-back') drawBack();
  if(action==='hint') hint();
  if(action==='mp-hint') hint();
  if(action==='add-lifeline') addLifelineByAd();
  if(action==='fullscreen') enterFullscreenByButton();
  if(action==='fullscreen-yes'){hideFullscreenPrompt();enterFullscreenByButton();}
  if(action==='fullscreen-no') hideFullscreenPrompt();
  if(action==='win-losuj') continueAfterWin();
  if(action==='win-menu') backToMenuAfterWin();
  if(action==='scale-down'){menuScale-=.06;applyScale();}
  if(action==='scale-up'){menuScale+=.06;applyScale();}
  if(action==='scale-reset'){menuScale=1;applyScale();}
  if(action==='dual-info') show('multiplayer');
  if(action==='multiplayer-back') show('menu');
  if(action==='create-room') createMultiplayerRoom();
  if(action==='join-room') joinMultiplayerRoom();
  if(action==='mp-leave-room') leaveMultiplayerRoom();
  if(action==='mp-start-game') startMultiplayerGame();
  if(action==='exit') alert('W wersji webowej zamknij kartę przeglądarki albo wróć przyciskiem systemowym.');
  if(action==='reset-stats' && confirm('Czy wyczyścić zapis i statystyki?')){
    localStorage.removeItem(STORE_KEY); state=loadState(); renderStats(); renderGallery();
  }
});

applyScale();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js?v=1118').catch(()=>{}));}

