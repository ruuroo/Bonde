/* AI og analyse – suggest_play(state, hand) -> card
   Forklaringsdata returneres via explainSuggest(state, hand, card)
   Vanskelighetsgrader:
   - easy: lavt gyldig kort / enkel "må ta"
   - medium: prøver å treffe bud: laveste vinnende hvis trenger stikk, ellers dump
   - hard: Monte-Carlo-ish fordeling for å makse P(slutt_stikk == bud)
*/

function cardKey(c){ return `${c.suit}${c.rank}`; }

function sortHandForDisplay(hand){
  const suitOrder = ['♠','♥','♦','♣'];
  const rankOrder = new Map(['2','3','4','5','6','7','8','9','10','J','Q','K','A'].map((r,i)=>[r, i]));
  return [...hand].sort((a,b)=>{
    const s = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if(s!==0) return s;
    return rankOrder.get(a.rank) - rankOrder.get(b.rank);
  });
}

function legalCards(state, hand){
  if(state.currentTrick.length === 0) return [...hand];
  const lead = state.leadSuit;
  const hasLead = hand.some(c=>c.suit===lead);
  return hasLead ? hand.filter(c=>c.suit===lead) : [...hand];
}

function compareCards(a, b, leadSuit, trump){
  if(a.suit===b.suit){
    const order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return order.indexOf(a.rank) - order.indexOf(b.rank);
  }
  if(a.suit===trump && b.suit!==trump) return 1;
  if(b.suit===trump && a.suit!==trump) return -1;
  if(a.suit===leadSuit && b.suit!==leadSuit) return 1;
  if(b.suit===leadSuit && a.suit!==leadSuit) return -1;
  return 0;
}

function winnerOfTrick(cards, leadSuit, trump){
  let bestIdx = 0;
  for(let i=1;i<cards.length;i++){
    const a = cards[bestIdx].card, b = cards[i].card;
    const cmp = compareCards(a,b,leadSuit,trump);
    if(cmp<0) bestIdx = i;
  }
  return cards[bestIdx].playerIndex;
}

/* ——— EASY ——— */
function easyAI(state, me){
  const need = me.bid - me.tricks;
  const hand = sortHandForDisplay(me.hand);
  const legals = legalCards(state, hand);
  if(need>0){
    const lead = state.leadSuit ?? null;
    const trump = state.trump;
    const candidates = [...legals].sort((a,b)=>compareCards(a,b,lead,trump));
    return candidates[candidates.length-1];
  }else{
    const order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return [...legals].sort((a,b)=>order.indexOf(a.rank)-order.indexOf(b.rank))[0];
  }
}

/* ——— MEDIUM ——— */
function mediumAI(state, me){
  const hand = sortHandForDisplay(me.hand);
  const legals = legalCards(state, hand);
  const need = me.bid - me.tricks;
  const lead = state.leadSuit ?? null;
  const trump = state.trump;
  const order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  function winsIfPlayed(card){
    const temp = state.currentTrick.map(x=>({playerIndex:x.playerIndex, card:x.card}));
    temp.push({playerIndex: me.index, card});
    const w = winnerOfTrick(temp, lead ?? card.suit, trump);
    return w===me.index;
  }
  const winning = legals.filter(winsIfPlayed).sort((a,b)=>order.indexOf(a.rank)-order.indexOf(b.rank));
  const losing  = legals.filter(c=>!winsIfPlayed(c)).sort((a,b)=>order.indexOf(a.rank)-order.indexOf(b.rank));
  if(need>0){
    if(winning.length) return winning[0];
    return [...legals].sort((a,b)=>order.indexOf(a.rank)-order.indexOf(b.rank)).at(-1);
  }else{
    if(losing.length) return losing[0];
    if(winning.length) return winning[0];
    return legals[0];
  }
}

/* ——— HARD ——— (Monte-Carlo-ish) */
function hardAI(state, me){
  const hand = sortHandForDisplay(me.hand);
  const legals = legalCards(state, hand);
  const samples = Math.max(200, 60 * state.players.length);
  const trump = state.trump;
  const leadSuit = state.currentTrick.length ? state.leadSuit : null;
  const need = me.bid - me.tricks;

  const allCards = makeDeck();
  const seen = new Set([
    ...state.discarded.map(cardKey),
    ...state.currentTrick.map(x=>cardKey(x.card)),
    ...me.hand.map(cardKey),
  ]);
  const unknown = allCards.filter(c=>!seen.has(cardKey(c)));

  const already = state.currentTrick.map(x=>x.playerIndex);
  const turnOrder = playersInTrickOrder(state.startingPlayer, state.players.length);
  const yetToPlay = turnOrder.filter(p=>!already.includes(p) && p!==me.index);

  const tally = new Map(legals.map(c=>[cardKey(c), {winNow:0, ev:0, sims:0, keepFlex: flexibilityScore(hand, c, trump)}]));

  for(let s=0;s<samples;s++){
    const hands = randomDealForOthers(state, me.index, unknown);
    for(const card of legals){
      const trick = state.currentTrick.map(x=>({playerIndex:x.playerIndex, card:x.card}));
      const lead = leadSuit ?? card.suit;
      trick.push({playerIndex: me.index, card});
      for(const p of yetToPlay){
        const oppHand = hands.get(p);
        const oppLegals = legalGivenLead(oppHand, lead);
        const oppCard = heurOppPlay(oppLegals, lead, trump);
        const idx = oppHand.findIndex(c=>cardKey(c)===cardKey(oppCard));
        oppHand.splice(idx,1);
        trick.push({playerIndex:p, card:oppCard});
      }
      const w = winnerOfTrick(trick, lead, trump);
      const willWin = (w===me.index);
      const evNow = (need>0 ? (willWin?1:-0.5) : (willWin?-0.7:1));
      const t = tally.get(cardKey(card));
      t.winNow += willWin ? 1 : 0;
      t.ev += evNow;
      t.sims += 1;
    }
  }

  let best = null, bestScore = -1e9;
  for(const card of legals){
    const t = tally.get(cardKey(card));
    const meanEV = t.ev / Math.max(1,t.sims);
    const bonusFlex = 0.01 * t.keepFlex;
    const score = meanEV + bonusFlex;
    if(score>bestScore){ bestScore=score; best=card; }
  }
  return best ?? mediumAI(state, me);
}

function flexibilityScore(hand, playCard, trump){
  const remaining = hand.filter(c=>cardKey(c)!==cardKey(playCard));
  let trumps = remaining.filter(c=>c.suit===trump).length;
  let aces = remaining.filter(c=>c.rank==='A').length;
  return 2*trumps + aces;
}

function legalGivenLead(hand, lead){
  const hasLead = hand.some(c=>c.suit===lead);
  return hasLead ? hand.filter(c=>c.suit===lead) : hand;
}
function heurOppPlay(legals, lead, trump){
  const order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  return [...legals].sort((a,b)=>order.indexOf(a.rank)-order.indexOf(b.rank))[0];
}

/*** Eksponert ***/
const AI_IMPL = { easy: easyAI, medium: mediumAI, hard: hardAI };
function suggest_play(state, hand){
  const me = state.players[state.turn];
  const impl = AI_IMPL[state.difficulty] ?? mediumAI;
  return impl(state, me);
}

/* Forklaring av hint: returnerer tekstlig begrunnelse og (for hard) estimert p(vinne stikk) */
function explainSuggest(state, hand, card){
  const lead = state.currentTrick.length ? state.leadSuit : card.suit;
  const legal = legalCards(state, hand);
  const mustFollow = hand.some(c=>c.suit===lead);
  const reasons = [];
  if(mustFollow) reasons.push(`må følge ${lead}`);
  if(card.suit===state.trump && lead!==state.trump) reasons.push(`trumfer over`);
  // enkel heuristikk
  if(state.difficulty==='hard'){
    // grov mini-sim for forklaring
    const me = state.players[state.turn];
    let sims=120, wins=0;
    for(let s=0;s<sims;s++){
      const all = makeDeck();
      const seen = new Set([
        ...state.discarded.map(cardKey),
        ...state.currentTrick.map(x=>cardKey(x.card)),
        ...hand.map(cardKey),
      ]);
      const unknown = all.filter(c=>!seen.has(cardKey(c)));
      const hands = randomDealForOthers(state, me.index, unknown);
      const trick = state.currentTrick.map(x=>({playerIndex:x.playerIndex, card:x.card}));
      trick.push({playerIndex: me.index, card});
      const order = playersInTrickOrder(state.startingPlayer, state.players.length);
      for(const p of order){
        if(p===me.index) continue;
        if(trick.find(x=>x.playerIndex===p)) continue;
        const oppHand = hands.get(p);
        const oppLegals = legalGivenLead(oppHand, lead);
        const oppCard = heurOppPlay(oppLegals, lead, state.trump);
        oppHand.splice(oppHand.findIndex(c=>cardKey(c)===cardKey(oppCard)),1);
        trick.push({playerIndex:p, card:oppCard});
      }
      const w = winnerOfTrick(trick, lead, state.trump);
      if(w===me.index) wins++;
    }
    const p = Math.round((wins/sims)*100);
    reasons.push(`forventet vinnersjanse ~${p}%`);
  }else{
    // medium: enkel vurdering
    reasons.push(`balanse mellom å treffe bud og spare høyder`);
  }
  return `Anbefaler ${card.suit}${card.rank} fordi ${reasons.join(', ')}.`;
}

/*** Delt hjelpefunksjoner (brukes også av script.js) ***/
function makeDeck(){
  const suits = ['♠','♥','♦','♣'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const d=[]; for(const s of suits) for(const r of ranks) d.push({suit:s, rank:r}); return d;
}
function playersInTrickOrder(starter, n){ return Array.from({length:n},(_,i)=>(starter+i)%n); }
function randomDealForOthers(state, meIndex, unknownCards){
  const hands = new Map(); const copy = [...unknownCards]; shuffle(copy);
  for(const p of state.players){
    if(p.index===meIndex) continue;
    const need = p.handSize - p.hand.length;
    hands.set(p.index, [...p.hand]);
    while(hands.get(p.index).length < p.handSize && copy.length){
      hands.get(p.index).push(copy.pop());
    }
  }
  return hands;
}
function shuffle(a){ for(let i=a.length-1;i>0;i++){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }
