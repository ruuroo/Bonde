/* Bondebridge – motor + UI (oppdatert)
   – Fase-styring: bidding / playing / reporting (hindrer "lock")
   – Dialog etter hvert stikk (klikk Neste stikk)
   – Tydelig trumf-badge
   – Tilfeldige AI-navn
   – Hint kun på knapp + forklaring via explainSuggest()
   – Ettertrekk-kommentar
   – Slow mode (forsink AI-spill)
   – Tavle (bud, stikk, poeng per runde + totalscore)
*/

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_IDX = new Map(RANKS.map((r,i)=>[r,i]));
const AI_NAMES = ['Kari','Ola','Maja','Lars','Nora','Hassan','Eva','Jonas','Ingrid','Sindre','Mikkel','Aisha','Mona','Erik','Anja','Sofie','Tobias','Iben'];

const qs = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];

const el = {
  playerCount: qs('#playerCount'),
  startCards: qs('#startCards'),
  difficulty: qs('#difficulty'),
  newGameBtn: qs('#newGameBtn'),
  historyBtn: qs('#historyBtn'),

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
  slowMode: qs('#slowMode'),

  adjustDialog: qs('#adjustDialog'),
  adjustInput: qs('#adjustInput'),
  trickReport: qs('#trickReport'),
  trickReportBody: qs('#trickReportBody'),
  roundReport: qs('#roundReport'),
  reportBody: qs('#reportBody'),

  historyDialog: qs('#historyDialog'),
  historyBody: qs('#historyBody'),
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
  deck: [],
  currentTrick: [],
  leadSuit: null,
  turn: 0,
  discarded: [],
  history: [],
  phase: 'bidding', // 'bidding' | 'playing' | 'reporting'
};

function init(){
  el.newGameBtn.addEventListener('click', newSeries);
  el.placeBidBtn.addEventListener('click', onPlaceBid);
  el.hintBtn.addEventListener('click', onHint);
  el.playerCount.addEventListener('change', onInputsChanged);
  el.startCards.addEventListener('change', onInputsChanged);
  el.historyBtn.addEventListener('click', showHistory);

  onInputsChanged();
  newSeries();
}

/* ---------- Setup / deck ---------- */

function onInputsChanged(){
  state.playerCount = parseInt(el.playerCount.value,10);
  const maxStart = Math.floor(52 / Math.max(2, state.playerCount || 2));
  el.startCards.max = String(maxStart);
  if(parseInt(el.startCards.value,10) > maxStart) el.startCards.value = String(maxStart);
}

/* Velg n unike navn tilfeldig uten å shuffle hele lista */
function pickNames(n){
  const pool = AI_NAMES.slice();
  const out = [];
  while(out.length < n && pool.length){
    const idx = (Math.random() * pool.length) | 0;
    out.push(pool.splice(idx,1)[0]);
  }
  while(out.length < n) out.push(`AI ${out.length+1}`);
  return out;
}

/* Robust Fisher–Yates */
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = (Math.random() * (i+1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function newSeries(){
  const n = parseInt(el.playerCount.value,10);
  const startCards = parseInt(el.startCards.value,10);
  if(!(n>=2 && n<=6)) return alert('Antall spillere må være 2–6.');
  const maxStart = Math.floor(52/n);
  if(!(startCards>=1 && startCards<=maxStart)) return alert(`Startkort må være 1–${maxStart}.`);

  state.playerCount = n;
  state.startCards = startCards;
  state.difficulty = el.difficulty.value;
  state.history = [];
  state.phase = 'bidding';

  state.players = [];
  const aiPicked = pickNames(n-1);
  for(let i=0;i<n;i++){
    state.players.push({
      index: i,
      name: i===0 ? 'Du' : aiPicked[i-1],
      hand: [],
      handSize: 0,
      bid: null,
      tricks: 0,
      score: 0,
      isHuman: i===0,
    });
  }

  const down = []; for(let k=startCards; k>=1; k--) down.push(k);
  const up = []; for(let k=2; k<=startCards; k++) up.push(k);
  state.roundSeq = down.concat(up);
  state.roundIndex = 0;

  state.dealer = Math.floor(Math.random()*n);
  state.discarded = [];

  startNextRound();
}

function startNextRound(){
  if(state.roundIndex >= state.roundSeq.length){ showFinal(); return; }
  state.phase = 'bidding';

  state.currentRoundCards = state.roundSeq[state.roundIndex];
  state.roundIndex++;

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

function makeDeck(){ const d=[]; for(const s of SUITS) for(const r of RANKS) d.push({suit:s, rank:r}); return d; }
function sortHand(hand){
  return [...hand].sort((a,b)=>{
    const s = SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit);
    if(s!==0) return s;
    return RANK_IDX.get(a.rank)-RANK_IDX.get(b.rank);
  });
}
function dealCards(k){
  state.deck = makeDeck(); shuffle(state.deck);
  state.players.forEach(p=>p.hand=[]);
  for(let i=0;i<k;i++){ for(let j=0;j<state.playerCount;j++){ state.players[j].hand.push(state.deck.pop()); } }
  for(const p of state.players){ p.hand = sortHand(p.hand); }
}

/* ---------- Bidding ---------- */

function beginBidding(){
  state.turn = (state.dealer + 1) % state.playerCount;
  if(state.turn===0) showHumanBid(); else aiBidTurn();
}

function totalBid(){ return state.players.reduce((s,p)=>s+(p.bid??0),0); }

function showHumanBid(){
  el.bidControls.classList.remove('hidden');
  el.playControls.classList.add('hidden');
  el.hintArea.textContent = '';
  el.humanBid.min = 0; el.humanBid.max = state.currentRoundCards;
  el.humanBid.value = 0;
}

function onPlaceBid(){
  const v = parseInt(el.humanBid.value,10);
  if(isNaN(v) || v<0 || v>state.currentRoundCards) return alert('Ugyldig bud.');
  placeBid(0, v);
}

function aiBidTurn(){
  const p = state.players[state.turn];
  if(p.isHuman) return showHumanBid();
  const est = estimateTricksForBid(state, p);
  let bid = Math.max(0, Math.min(state.currentRoundCards, Math.round(est)));
  if(state.difficulty==='easy') bid = Math.max(0, Math.min(state.currentRoundCards, Math.round(est*0.9)));
  if(state.difficulty==='hard') bid = Math.max(0, Math.min(state.currentRoundCards, Math.round(est)));
  setTimeout(()=>placeBid(p.index, bid), el.slowMode?.checked?700:300);
}

function placeBid(playerIndex, value){
  if(state.phase!=='bidding') return;
  state.players[playerIndex].bid = value;

  if(nextUnbid()!==null){
    state.turn = nextUnbid();
    if(state.turn===0) showHumanBid(); else aiBidTurn();
  }else{
    if(totalBid()===state.currentRoundCards){
      const adjIdx = (state.dealer + 1) % state.playerCount;
      if(adjIdx===0){
        showAdjustDialog(adjIdx);
      }else{
        // AI må justere (forby forbudt totalsum)
        const p = state.players[adjIdx];
        const est = estimateTricksForBid(state, p);
        const currentTotal = totalBid();
        const min = 0, max = state.currentRoundCards;

        const candidates = [];
        for (let b = min; b <= max; b++) {
          if (b === p.bid) continue; // må endre
          const newTotal = currentTotal - p.bid + b;
          if (newTotal === state.currentRoundCards) continue; // forbudt
          candidates.push({ b, diff: Math.abs(b - est) });
        }
        candidates.sort((a,b)=>a.diff - b.diff);

        p.bid = candidates.length ? candidates[0].b
                                  : (p.bid + 1 <= max ? p.bid + 1 : Math.max(min, p.bid - 1));
        afterBidding();
      }
    }else{
      afterBidding();
    }
  }
  renderAll();
}

function showAdjustDialog(adjIdx){
  const currentTotal = totalBid();
  const old = state.players[adjIdx].bid;
  const min = 0, max = state.currentRoundCards;

  el.adjustInput.min = String(min);
  el.adjustInput.max = String(max);
  el.adjustInput.value = String(old);

  // Tekst som peker på riktig spiller
  el.adjustDialog.querySelector('h3').textContent = 'Sperreregel';
  el.adjustDialog.querySelector('p').innerHTML =
    `Summen av bud er <b>${currentTotal}</b> og det er <b>${state.currentRoundCards}</b> kort i runden. ` +
    `Spilleren til venstre for dealer, <b>${state.players[adjIdx].name}</b>, må justere sitt bud.`;

  el.adjustDialog.returnValue = '';
  el.adjustDialog.showModal();

  const onClose = () => {
    el.adjustDialog.removeEventListener('close', onClose);

    let val = parseInt(el.adjustInput.value,10);
    if (Number.isNaN(val)) val = old;

    // Clamp
    val = Math.max(min, Math.min(max, val));

    // Forby likhet: Ny total = currentTotal - old + val
    if ((currentTotal - old + val) === state.currentRoundCards) {
      if (val + 1 <= max && (currentTotal - old + (val+1)) !== state.currentRoundCards) val = val + 1;
      else if (val - 1 >= min && (currentTotal - old + (val-1)) !== state.currentRoundCards) val = val - 1;
      else val = (val === 0) ? 1 : 0; // siste utvei
    }

    state.players[adjIdx].bid = val;
    renderAll();
    afterBidding();
  };
  el.adjustDialog.addEventListener('close', onClose, { once: true });
}

function nextUnbid(){ for(let i=0;i<state.playerCount;i++){ if(state.players[i].bid===null) return i; } return null; }

function afterBidding(){
  const bids = state.players.map((p,i)=>({i, bid:p.bid}));
  const maxBid = Math.max(...bids.map(b=>b.bid));
  const tied = bids.filter(b=>b.bid===maxBid).map(b=>b.i);
  if(tied.length===1){
    state.startingPlayer = tied[0];
  }else{
    const order = playersInTrickOrder((state.dealer+1)%state.playerCount, state.playerCount);
    state.startingPlayer = order.find(i=>tied.includes(i));
  }
  state.turn = state.startingPlayer;
  state.phase = 'playing';
  renderAll();
  beginTrickOrNext();
}

/* ---------- Playing ---------- */

function beginTrickOrNext(){
  if(state.phase!=='playing') return;
  const totalTricks = state.currentRoundCards;
  const wonTricks = state.players.reduce((s,p)=>s+p.tricks,0);
  if(wonTricks === totalTricks){
    state.phase = 'reporting';
    scoreRoundAndReport();
    return;
  }
  if(state.currentTrick.length===0){ state.leadSuit = null; }
  nextTurnPlay();
}

function nextTurnPlay(){
  renderAll();
  const p = state.players[state.turn];
  if(p.isHuman){ showHumanPlay(); }
  else setTimeout(()=>aiPlayCard(p), el.slowMode?.checked?800:350);
}

function showHumanPlay(){
  el.bidControls.classList.add('hidden');
  el.playControls.classList.remove('hidden');
  renderHand(true);
}

function onHint(){
  const me = state.players[0];
  const candidate = suggest_play(extractPublicState(), me.hand);
  if(!candidate){ el.hintArea.textContent = 'Ingen hint tilgjengelig.'; return; }
  const why = explainSuggest(extractPublicState(), me.hand, candidate);
  el.hintArea.textContent = why;
}

function aiPlayCard(p){
  const card = (state.difficulty==='easy') ? AI_IMPL.easy(extractPublicState(), p)
            : (state.difficulty==='medium') ? AI_IMPL.medium(extractPublicState(), p)
            : AI_IMPL.hard(extractPublicState(), p);
  playCard(p.index, card);
}

function playCard(playerIndex, card){
  if(state.phase!=='playing') return;

  const p = state.players[playerIndex];
  const idx = p.hand.findIndex(c=>c.suit===card.suit && c.rank===card.rank);
  if(idx<0) return;
  p.hand.splice(idx,1);

  if(state.currentTrick.length===0) state.leadSuit = card.suit;

  state.currentTrick.push({playerIndex, card});
  state.discarded.push(card);

  if(state.currentTrick.length===state.playerCount){
    const winner = winnerOfTrick(state.currentTrick, state.leadSuit, state.trump);
    state.players[winner].tricks += 1;
    state.startingPlayer = winner;
    state.turn = winner;
    el.trickWinner.textContent = `${state.players[winner].name} vant stikket.`;
    renderAll();

    const lines = state.currentTrick.map(tc=>{
      const c = tc.card; const red = (c.suit==='♥'||c.suit==='♦')?'style="color:#ff7d7d"':'';
      return `<div class="cardLine"><strong>${state.players[tc.playerIndex].name}</strong> spilte <span ${red}>${c.suit}${c.rank}</span></div>`;
    }).join('');
    el.trickReportBody.innerHTML = `<div class="trickList">${lines}</div><p><b>Vinner:</b> ${state.players[winner].name}</p>`;
    el.trickReport.showModal();
    el.trickReport.addEventListener('close', ()=>{
      state.currentTrick = [];
      state.leadSuit = null;
      el.trickWinner.textContent = '';
      beginTrickOrNext();
    }, {once:true});
  }else{
    state.turn = (state.turn + 1) % state.playerCount;
    nextTurnPlay();
  }
}

/* ---------- Render ---------- */

function renderAll(){
  const sum = totalBid();
  el.roundInfo.textContent =
    `Runde ${state.roundIndex}/${state.roundSeq.length} — ${state.currentRoundCards} kort (sum bud: ${isNaN(sum)?0:sum})`;
  const trumpRed = (state.trump==='♥'||state.trump==='♦') ? 'trumpBadge trumpRed' : 'trumpBadge';
  el.trumpInfo.innerHTML = `Trumf: <span class="${trumpRed}">${state.trump}</span>`;
  el.dealerInfo.textContent = `Dealer: ${state.players[state.dealer].name}`;
  el.starterInfo.textContent = `Starter: ${state.startingPlayer!=null ? state.players[state.startingPlayer].name : '—'}`;

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

  el.trickCards.innerHTML = state.currentTrick.map(tc=>{
    const c = tc.card; const red = (c.suit==='♥'||c.suit==='♦')?'red':'';
    return `<div class="card"><span class="suit ${red}">${c.suit}</span><span class="rank ${red}">${c.rank}</span>
      <div style="font-size:12px;margin-top:4px;">${state.players[tc.playerIndex].name}</div></div>`;
  }).join('');

  el.scoresPanel.innerHTML = `<h3>Stillingen</h3><div>${state.players.map(p=>`${p.name}: ${p.score}`).join(' • ')}</div>`;

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
  qsa('#hand .cardBtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const idx = parseInt(btn.getAttribute('data-i'),10);
      const card = state.players[0].hand[idx];
      const me = state.players[0];
      const recommended = suggest_play(extractPublicState(), me.hand);
      const recStr = recommended ? `${recommended.suit}${recommended.rank}` : null;
      const playedStr = `${card.suit}${card.rank}`;
      playCard(0, card);
      if(recStr){
        const why = explainSuggest(extractPublicState(), me.hand, recommended);
        el.hintArea.textContent = (recStr !== playedStr)
          ? `Ettertrekk: ${why}`
          : `Godt valg: ${why}`;
      }else{
        el.hintArea.textContent = '';
      }
    });
  });
}

/* ---------- Estimat før bud ---------- */

function estimateTricksForBid(st, p){
  const trump = st.trump;
  let score = 0;
  for(const c of p.hand){
    if(c.suit===trump) score += 0.6;
    if(c.rank==='A') score += 0.8;
    if(c.rank==='K') score += 0.5;
    if(c.rank==='Q') score += 0.3;
  }
  const counts = Object.fromEntries(SUITS.map(s=>[s,0])); p.hand.forEach(c=>counts[c.suit]++);
  for(const s of SUITS){ if(counts[s]>=4) score += 0.3*(counts[s]-3); }
  return Math.min(st.currentRoundCards, Math.max(0, score*0.45));
}

/* ---------- Scoring & history ---------- */

function scoreRoundAndReport(){
  const logs = [];
  const rows = [];
  for(const p of state.players){
    let pts = 0;
    if(p.bid===0 && p.tricks===0) pts = 5;
    else if(p.bid===p.tricks) pts = 10 + p.tricks;
    else pts = 0;
    p.score += pts;
    rows.push({name:p.name, bid:p.bid, tricks:p.tricks, points:pts});
    const style = (p.bid===p.tricks) ? '✅' : (p.bid===0 && p.tricks===0) ? '⭕' : '❌';
    logs.push(`${style} ${p.name}: bud ${p.bid}, stikk ${p.tricks} → ${pts} poeng`);
  }

  state.history.push({
    roundNo: state.roundIndex,
    cards: state.currentRoundCards,
    trump: state.trump,
    dealerName: state.players[state.dealer].name,
    starterName: state.players[state.startingPlayer]?.name ?? '—',
    rows
  });

  const body = `
    <p><b>Runde ferdig.</b></p>
    <p>${logs.join('<br>')}</p>
    <p><i>Tips:</i> Vanskelig-AI maksimerer sannsynlighet for å lande på budet, ikke bare vinne enkeltstikk.</p>
  `;
  el.reportBody.innerHTML = body;
  el.roundReport.showModal();
  el.roundReport.addEventListener('close', ()=>{
    startNextRound();
  }, {once:true});
}

/* ---------- Tavle ---------- */

function showHistory(){
  el.historyBody.innerHTML = renderHistoryHTML();
  el.historyDialog.showModal();
}

function renderHistoryHTML(){
  if(state.history.length===0){ return `<p>Ingen runder spilt enda.</p>`; }
  const totals = state.players.map(p=>({name:p.name, score:p.score}));
  const totalsLine = totals.map(t=>`${t.name}: <b>${t.score}</b>`).join(' • ');

  const head = `
    <thead>
      <tr>
        <th>Runde</th><th>Kort</th><th>Trumf</th><th>Dealer</th><th>Starter</th>
        <th>Spiller</th><th>Bud</th><th>Stikk</th><th>Poeng</th>
      </tr>
    </thead>`;
  const rows = [];
  for(const r of state.history){
    r.rows.forEach((row, i)=>{
      rows.push(`
        <tr>
          ${i===0?`<td rowspan="${r.rows.length}">${r.roundNo}</td>
                   <td rowspan="${r.rows.length}">${r.cards}</td>
                   <td rowspan="${r.rows.length}">${r.trump}</td>
                   <td rowspan="${r.rows.length}">${r.dealerName}</td>
                   <td rowspan="${r.rows.length}">${r.starterName}</td>`:''}
          <td>${row.name}</td>
          <td>${row.bid}</td>
          <td>${row.tricks}</td>
          <td>${row.points}</td>
        </tr>`);
    });
  }
  return `
    <p><b>Totalscore:</b> ${totalsLine}</p>
    <div class="tableWrap">
      <table class="historyTable">
        ${head}
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

/* ---------- Trick rules ---------- */

function compareCards(a, b, leadSuit, trump){
  if(a.suit===b.suit){ return RANK_IDX.get(a.rank)-RANK_IDX.get(b.rank); }
  if(a.suit===trump && b.suit!==trump) return 1;
  if(b.suit===trump && a.suit!==trump) return -1;
  if(a.suit===leadSuit && b.suit!==leadSuit) return 1;
  if(b.suit===leadSuit && a.suit!==leadSuit) return -1;
  return 0;
}
function winnerOfTrick(cards, leadSuit, trump){
  let best=0; for(let i=1;i<cards.length;i++){
    if(compareCards(cards[best].card, cards[i].card, leadSuit, trump)<0) best=i;
  } return cards[best].playerIndex;
}
function playersInTrickOrder(starter, n){ return Array.from({length:n},(_,i)=>(starter+i)%n); }

/* ---------- Public state to AI ---------- */

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

/* ---------- Series-slutt ---------- */
function showFinal(){
  const totals = state.players.map(p=>`${p.name}: ${p.score}`).join(' • ');
  el.reportBody.innerHTML = `<p><b>Spillserien er ferdig!</b></p><p>${totals}</p>`;
  el.roundReport.showModal();
  el.roundReport.addEventListener('close', ()=>newSeries(), {once:true});
}

/* ---------- Boot ---------- */
window.addEventListener('DOMContentLoaded', init);
