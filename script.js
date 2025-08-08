/* Bondebridge – motor + UI
   – Regler iht. spes: rundeoppsett, bud (m/ sperreregel), høyeste bud starter,
     stikkspilling, poeng (null=+5, treff=+10+stikk, bom=0).
   – Hint bruker suggest_play(state, hand) fra ai.js
*/

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_IDX = new Map(RANKS.map((r,i)=>[r,i]));

const qs = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];

const el = {
  playerCount: qs('#playerCount'),
  startCards: qs('#startCards'),
  difficulty: qs('#difficulty'),
  newGameBtn: qs('#newGameBtn'),
  roundInfo: qs('#roundInfo'),
  trumpInfo: qs('#trumpInfo'),
  dealerInfo: qs('#dealerInfo'),
  starterInfo: qs('#starterInfo'),
  bidsPanel: qs('#bidsPanel'),
  trickCards: qs('#trickCards'),
  trickWinner: qs('#trickWinner'),
  scoresPanel: qs('#scoresPanel'),
  hand: qs('#hand'),
  bidControls: qs('#bidControls'),
  humanBid: qs('#humanBid'),
  placeBidBtn: qs('#placeBidBtn'),
  playControls: qs('#playControls'),
  hintBtn: qs('#hintBtn'),
  hintArea: qs('#hintArea'),
  adjustDialog: qs('#adjustDialog'),
  adjustInput: qs('#adjustInput'),
  roundReport: qs('#roundReport'),
  reportBody: qs('#reportBody'),
};

const state = {
  players: [],
  humanIndex: 0,
  playerCount: 4,
  startCards: 5,
  currentRoundCards: 0,
  roundSeq: [],
  roundIndex: 0,
  trump: null,
  dealer: 0,
  startingPlayer: 0,
  difficulty: 'medium',
  // dynamisk:
  deck: [],
  currentTrick: [],
  leadSuit: null,
  turn: 0,
  discarded: [], // spilte kort historie
};

function init(){
  el.newGameBtn.addEventListener('click', newSeries);
  el.placeBidBtn.addEventListener('click', onPlaceBid);
  el.hintBtn.addEventListener('click', onHint);
  el.playerCount.addEventListener('change', onInputsChanged);
  el.startCards.addEventListener('change', onInputsChanged);
  onInputsChanged();
  // default
  newSeries();
}

function onInputsChanged(){
  state.playerCount = parseInt(el.playerCount.value,10);
  const maxStart = Math.floor(52 / state.playerCount);
  el.startCards.max = String(maxStart);
  if(parseInt(el.startCards.value,10) > maxStart) el.startCards.value = String(maxStart);
}

function newSeries(){
  // valider input
  const n = parseInt(el.playerCount.value,10);
  const startCards = parseInt(el.startCards.value,10);
  if(!(n>=2 && n<=6)) return alert('Antall spillere må være 2–6.');
  const maxStart = Math.floor(52/n);
  if(!(startCards>=1 && startCards<=maxStart)) return alert(`Startkort må være 1–${maxStart}.`);

  state.playerCount = n;
  state.startCards = startCards;
  state.difficulty = el.difficulty.value;

  // sett opp spillere (index 0 er menneske)
  state.players = [];
  for(let i=0;i<n;i++){
    state.players.push({
      index: i,
      name: i===0 ? 'Du' : `AI ${i}`,
      hand: [],
      handSize: 0,
      bid: null,
      tricks: 0,
      score: 0,
      isHuman: i===0,
    });
  }

  // runde-sekvens: ned til 1, opp igjen
  const down = [];
  for(let k=startCards; k>=1; k--) down.push(k);
  const up = [];
  for(let k=2; k<=startCards; k++) up.push(k);
  state.roundSeq = down.concat(up);
  state.roundIndex = 0;

  state.dealer = (Math.floor(Math.random()*n)); // tilfeldig dealer start
  state.discarded = [];

  startNextRound();
}

function startNextRound(){
  if(state.roundIndex >= state.roundSeq.length){
    // ferdig – serieslutt
    showFinal();
    return;
  }
  state.currentRoundCards = state.roundSeq[state.roundIndex];
  state.roundIndex++;

  // ny runde
  state.trump = SUITS[Math.floor(Math.random()*4)];
  state.dealer = (state.dealer + 1) % state.playerCount;
  dealCards(state.currentRoundCards);
  state.startingPlayer = null;
  state.currentTrick = [];
  state.leadSuit = null;
  state.turn = (state.dealer + 1) % state.playerCount;

  state.players.forEach(p=>{ p.bid=null; p.tricks=0; p.handSize = state.currentRoundCards; });

  renderAll();
  beginBidding();
}

function makeDeck(){
  const d=[];
  for(const s of SUITS) for(const r of RANKS) d.push({suit:s, rank:r});
  return d;
}

function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];
  }
}

function dealCards(k){
  state.deck = makeDeck();
  shuffle(state.deck);
  state.players.forEach(p=>p.hand=[]);
  for(let i=0;i<k;i++){
    for(let j=0;j<state.playerCount;j++){
      state.players[j].hand.push(state.deck.pop());
    }
  }
  // sortér hender for visning (suit, rank)
  for(const p of state.players){
    p.hand = sortHand(p.hand);
  }
}

function sortHand(hand){
  return [...hand].sort((a,b)=>{
    const s = SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit);
    if(s!==0) return s;
    return RANK_IDX.get(a.rank)-RANK_IDX.get(b.rank);
  });
}

function beginBidding(){
  // bud starter til venstre for dealer, går rundt bordet
  state.turn = (state.dealer + 1) % state.playerCount;
  if(state.turn===0) showHumanBid(); else aiBidTurn();
}

function totalBid(){
  return state.players.reduce((s,p)=>s+(p.bid??0),0);
}

function showHumanBid(){
  el.bidControls.classList.remove('hidden');
  el.playControls.classList.add('hidden');
  el.hintArea.textContent = '';
  // vis estimat før bud (enkel heuristikk)
  const estimate = estimateTricksForBid(state, state.players[0]);
  el.hintArea.textContent = `Estimert stikk denne runden: ${estimate.toFixed(1)} (trumf ${state.trump}).`;
  el.humanBid.min = 0;
  el.humanBid.max = state.currentRoundCards;
  el.humanBid.value = Math.min(state.currentRoundCards, Math.max(0, Math.round(estimate)));
}

function onPlaceBid(){
  const v = parseInt(el.humanBid.value,10);
  if(isNaN(v) || v<0 || v>state.currentRoundCards) return alert('Ugyldig bud.');
  placeBid(0, v);
}

function aiBidTurn(){
  const p = state.players[state.turn];
  if(p.isHuman) return showHumanBid();
  // enkel budlogikk: bruk forventning + liten variasjon, juster for sperreregel etterpå
  const est = estimateTricksForBid(state, p);
  let bid = Math.max(0, Math.min(state.currentRoundCards, Math.round(est)));
  // litt støy
  if(state.difficulty==='easy') bid = Math.max(0, Math.min(state.currentRoundCards, Math.round(est*0.9)));
  if(state.difficulty==='hard') bid = Math.max(0, Math.min(state.currentRoundCards, Math.round(est)));
  // plasser
  setTimeout(()=>placeBid(p.index, bid), 400);
}

function placeBid(playerIndex, value){
  state.players[playerIndex].bid = value;

  // neste
  if(nextUnbid()!==null){
    state.turn = nextUnbid();
    if(state.turn===0) showHumanBid(); else aiBidTurn();
  }else{
    // alle har bud: sperreregel?
    if(totalBid()===state.currentRoundCards){
      // spilleren til venstre for dealer må justere umiddelbart
      const adjIdx = (state.dealer + 1) % state.playerCount;
      if(adjIdx===0){
        // mennesket må justere
        showAdjustDialog(adjIdx);
      }else{
        // AI justerer: velg nærmeste alternative bud (prioriterer mot å treffe sitt est.)
        const p = state.players[adjIdx];
        const est = estimateTricksForBid(state, p);
        let candidates = [];
        for(let b=0;b<=state.currentRoundCards;b++){
          if(b===p.bid) continue;
          if(totalBid() - p.bid + b === state.currentRoundCards) continue; // fortsatt sperre – unngå
          candidates.push({b, diff: Math.abs(b-est)});
        }
        candidates.sort((a,b)=>a.diff-b.diff);
        p.bid = candidates.length? candidates[0].b : Math.max(0, Math.min(state.currentRoundCards, p.bid + 1));
        afterBidding();
      }
    }else{
      afterBidding();
    }
  }
  renderAll();
}

function showAdjustDialog(adjIdx){
  el.adjustInput.min = 0;
  el.adjustInput.max = state.currentRoundCards;
  el.adjustInput.value = state.players[adjIdx].bid;
  el.adjustDialog.returnValue = '';
  el.adjustDialog.showModal();
  el.adjustDialog.addEventListener('close', ()=>{
    let val = parseInt(el.adjustInput.value,10);
    if(isNaN(val)) val = state.players[adjIdx].bid;
    // må bli forskjellig og ikke summere til runde-størrelse
    if(val===state.players[adjIdx].bid) val = Math.max(0, Math.min(state.currentRoundCards, val+(val<state.currentRoundCards?1:-1)));
    // hvis fortsatt sperre, skyv én til
    if(totalBid() - state.players[adjIdx].bid + val === state.currentRoundCards){
      val = (val+1<=state.currentRoundCards)? val+1 : Math.max(0, val-2);
    }
    state.players[adjIdx].bid = Math.max(0, Math.min(state.currentRoundCards, val));
    renderAll();
    afterBidding();
  }, {once:true});
}

function nextUnbid(){
  for(let i=0;i<state.playerCount;i++){
    if(state.players[i].bid===null) return i;
  }
  return null;
}

function afterBidding(){
  // Høyeste bud starter stikk 1.
  // Ved likt høyest: nærmest venstre for dealer blant dem.
  const bids = state.players.map((p,i)=>({i, bid:p.bid}));
  const maxBid = Math.max(...bids.map(b=>b.bid));
  const tied = bids.filter(b=>b.bid===maxBid).map(b=>b.i);
  if(tied.length===1){
    state.startingPlayer = tied[0];
  }else{
    // finn nærmest venstre for dealer
    const order = playersInTrickOrder((state.dealer+1)%state.playerCount, state.playerCount);
    state.startingPlayer = order.find(i=>tied.includes(i));
  }
  state.turn = state.startingPlayer;
  renderAll();
  beginTrickOrNext();
}

function beginTrickOrNext(){
  // hvis alle stikk spilt i runden: score, rapport, neste runde
  const totalTricks = state.currentRoundCards;
  const playedTricks = state.players.reduce((s,p)=>s+p.tricks,0);
  if(playedTricks === totalTricks*state.playerCount){
    scoreRoundAndReport();
    return;
  }
  // nytt stikk hvis bordet tomt
  if(state.currentTrick.length===0){
    state.leadSuit = null;
  }
  nextTurnPlay();
}

function nextTurnPlay(){
  renderAll();
  const p = state.players[state.turn];
  if(p.isHuman){
    // aktiver håndknapper
    showHumanPlay();
  }else{
    setTimeout(()=>aiPlayCard(p), 450);
  }
}

function showHumanPlay(){
  el.bidControls.classList.add('hidden');
  el.playControls.classList.remove('hidden');
  // render hånd med spillbare kort aktivert
  renderHand(true);
}

function onHint(){
  const me = state.players[0];
  const card = suggest_play(extractPublicState(), me.hand);
  if(!card){ el.hintArea.textContent = 'Ingen hint tilgjengelig.'; return; }
  el.hintArea.textContent = `Anbefalt: ${card.suit}${card.rank}`;
}

function aiPlayCard(p){
  const card = (state.difficulty==='easy') ? AI_IMPL.easy(extractPublicState(), p)
            : (state.difficulty==='medium') ? AI_IMPL.medium(extractPublicState(), p)
            : AI_IMPL.hard(extractPublicState(), p);
  playCard(p.index, card);
}

function playCard(playerIndex, card){
  // fjern fra hånd
  const p = state.players[playerIndex];
  const idx = p.hand.findIndex(c=>c.suit===card.suit && c.rank===card.rank);
  if(idx<0) return; // sikring
  p.hand.splice(idx,1);

  if(state.currentTrick.length===0) state.leadSuit = card.suit;

  state.currentTrick.push({playerIndex, card});
  state.discarded.push(card);

  // alle har spilt i stikk?
  if(state.currentTrick.length===state.playerCount){
    const winner = winnerOfTrick(state.currentTrick, state.leadSuit, state.trump);
    state.players[winner].tricks += 1;
    state.startingPlayer = winner;
    state.turn = winner;
    // vis hvem som vant stikk
    el.trickWinner.textContent = `${state.players[winner].name} vant stikket.`;
    renderAll();
    // rydd bordet
    setTimeout(()=>{
      state.currentTrick = [];
      state.leadSuit = null;
      el.trickWinner.textContent = '';
      beginTrickOrNext();
    }, 700);
  }else{
    // neste spiller
    state.turn = (state.turn + 1) % state.playerCount;
    nextTurnPlay();
  }
}

function renderAll(){
  // info
  el.roundInfo.textContent = `Runde ${state.roundIndex}/${state.roundSeq.length} — ${state.currentRoundCards} kort`;
  el.trumpInfo.textContent = `Trumf: ${state.trump}`;
  el.dealerInfo.textContent = `Dealer: ${state.players[state.dealer].name}`;
  el.starterInfo.textContent = `Starter: ${state.startingPlayer!=null ? state.players[state.startingPlayer].name : '—'}`;

  // bud/scores
  el.bidsPanel.innerHTML = state.players.map(p=>{
    const isDealer = p.index===state.dealer;
    const isStarter = state.startingPlayer===p.index;
    return `<div class="playerBox ${isDealer?'dealer':''} ${isStarter?'starter':''}">
      <div class="playerName">${p.name}
        ${isDealer?'<span class="badge dealer">Dealer</span>':''}
        ${isStarter?'<span class="badge">Starter</span>':''}
      </div>
      <div>Bud: <span class="badge bid">${p.bid==null?'—':p.bid}</span></div>
      <div>Stikk: <span class="badge tricks">${p.tricks}</span></div>
      <div>Poeng: <span class="badge score">${p.score}</span></div>
    </div>`;
  }).join('');

  // trick
  el.trickCards.innerHTML = state.currentTrick.map(tc=>{
    const c = tc.card;
    const red = (c.suit==='♥'||c.suit==='♦')?'red':'';
    return `<div class="card">
      <span class="suit ${red}">${c.suit}</span><span class="rank ${red}">${c.rank}</span>
      <div style="font-size:12px;margin-top:4px;">${state.players[tc.playerIndex].name}</div>
    </div>`;
  }).join('');

  // scores tabell (summer)
  el.scoresPanel.innerHTML = `<h3>Stillingen</h3>` + 
    `<div>${state.players.map(p=>`${p.name}: ${p.score}`).join(' • ')}</div>`;

  // hånd
  renderHand(state.players[state.turn]?.isHuman && state.currentTrick.length>=0);
}

function renderHand(enablePlay){
  const me = state.players[0];
  const lead = state.leadSuit;
  const hasLead = lead && me.hand.some(c=>c.suit===lead);
  el.hand.innerHTML = me.hand.map((c,i)=>{
    const red = (c.suit==='♥'||c.suit==='♦')?'red':'';
    const legal = !lead || (hasLead ? c.suit===lead : true);
    const disabled = !(enablePlay && legal && state.turn===0 && state.currentTrick.length<=state.playerCount);
    return `<button class="card cardBtn" data-i="${i}" ${disabled?'disabled':''} title="${legal?'Spill':'Må følge farge'}">
      <span class="suit ${red}">${c.suit}</span><span class="rank ${red}">${c.rank}</span>
    </button>`;
  }).join('');
  // klikk
  qsa('#hand .cardBtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = parseInt(btn.getAttribute('data-i'),10);
      const card = state.players[0].hand[idx];
      playCard(0, card);
    });
  });
}

/*** Vurdering/estimat før bud (enkel, rask) ***/
function estimateTricksForBid(st, p){
  // Trumftetthet + høyder gir poeng; grovt lineært estimat
  const trump = st.trump;
  let score = 0;
  for(const c of p.hand){
    if(c.suit===trump) score += 0.6;
    if(c.rank==='A') score += 0.8;
    if(c.rank==='K') score += 0.5;
    if(c.rank==='Q') score += 0.3;
    // lengdebonus
  }
  // lengde per farge
  const counts = Object.fromEntries(SUITS.map(s=>[s,0]));
  p.hand.forEach(c=>counts[c.suit]++);
  for(const s of SUITS){
    if(counts[s]>=4) score += 0.3*(counts[s]-3);
  }
  // skaler grovt
  const est = Math.min(st.currentRoundCards, Math.max(0, score*0.45));
  return est;
}

/*** Scoring ***/
function scoreRoundAndReport(){
  // poeng:
  // nullbud==0 -> +5
  // fulltreffer -> +10 + stikk
  // ellers 0
  const logs = [];
  for(const p of state.players){
    let pts = 0;
    if(p.bid===0 && p.tricks===0) pts = 5;
    else if(p.bid===p.tricks) pts = 10 + p.tricks;
    else pts = 0;
    p.score += pts;
    const style = (p.bid===p.tricks) ? '✅'
                : (p.bid===0 && p.tricks===0) ? '⭕'
                : '❌';
    logs.push(`${style} ${p.name}: bud ${p.bid}, stikk ${p.tricks} → ${pts} poeng`);
  }

  // rapport med noen nøkkelinnsikter (enkel)
  const body = `
    <p><b>Runde ferdig.</b></p>
    <p>${logs.join('<br>')}</p>
    <p><i>Tips:</i> Justér bud litt mot trumf-lengde og toppkort. Vanskelig-AI forsøker å makse sannsynlighet for å lande på budet, ikke bare vinne enkeltstikk.</p>
  `;
  el.reportBody.innerHTML = body;
  el.roundReport.showModal();
  el.roundReport.addEventListener('close', ()=>{
    startNextRound();
  }, {once:true});
}

/*** Hjelp: hvem vinner stikk ***/
function compareCards(a, b, leadSuit, trump){
  if(a.suit===b.suit){
    return RANK_IDX.get(a.rank)-RANK_IDX.get(b.rank);
  }
  if(a.suit===trump && b.suit!==trump) return 1;
  if(b.suit===trump && a.suit!==trump) return -1;
  if(a.suit===leadSuit && b.suit!==leadSuit) return 1;
  if(b.suit===leadSuit && a.suit!==leadSuit) return -1;
  return 0;
}
function winnerOfTrick(cards, leadSuit, trump){
  let best=0;
  for(let i=1;i<cards.length;i++){
    if(compareCards(cards[best].card, cards[i].card, leadSuit, trump)<0) best=i;
  }
  return cards[best].playerIndex;
}
function playersInTrickOrder(starter, n){
  return Array.from({length:n},(_,i)=>(starter+i)%n);
}

/*** PublicState til AI ***/
function extractPublicState(){
  return {
    players: state.players.map(p=>({
      index: p.index, bid: p.bid, tricks: p.tricks,
      hand: p.hand, handSize: state.currentRoundCards, isHuman: p.isHuman, name: p.name
    })),
    playerCount: state.playerCount,
    currentRoundCards: state.currentRoundCards,
    trump: state.trump,
    dealer: state.dealer,
    startingPlayer: state.startingPlayer ?? state.turn,
    currentTrick: state.currentTrick.map(x=>({playerIndex:x.playerIndex, card: x.card})),
    leadSuit: state.leadSuit,
    turn: state.turn,
    discarded: state.discarded.slice(),
    difficulty: state.difficulty,
  };
}

/*** Utils ***/
function cardStr(c){ return `${c.suit}${c.rank}`; }

/*** Start ***/
window.addEventListener('DOMContentLoaded', init);

