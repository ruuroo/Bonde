/* AI og analyse – felles suggest_play(state, hand) -> card
   Vanskelighetsgrader:
   - easy: lavt gyldig kort, enkel "ta når må"
   - medium: prøver å treffe bud, laveste vinnende hvis trenger stikk ellers dump
   - hard: Monte-Carlo/fordelingsmodell for å makse P(slutt_stikk == bud)
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
  // state.currentTrick: [{playerIndex, card}], state.leadSuit, state.trump
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
  // trumf slår alt
  if(a.suit===trump && b.suit!==trump) return 1;
  if(b.suit===trump && a.suit!==trump) return -1;
  // ellers bare ledet farge teller
  if(a.suit===leadSuit && b.suit!==leadSuit) return 1;
  if(b.suit===leadSuit && a.suit!==leadSuit) return -1;
  return 0; // begge off-suit uten trumf
}

function winnerOfTrick(cards, leadSuit, trump){
  // cards: [{playerIndex, card}]
  let bestIdx = 0;
  for(let i=1;i<cards.length;i++){
    const a = cards[bestIdx].card, b = cards[i].card;
    const cmp = compareCards(a,b,leadSuit,trump);
    if(cmp<0) bestIdx = i;
  }
  return cards[bestIdx].playerIndex;
}

function easyAI(state, me){
  const need = me.bid - me.tricks;
  const hand = sortHandForDisplay(me.hand);
  const legals = legalCards(state, hand);
  if(need>0){
    // prøv å vinne billig: velg laveste kort som sannsynlig vinner nå (heuristikk)
    const lead = state.leadSuit ?? null;
    const trump = state.trump;
    // grov heuristikk: prøv høyeste i ledet/trumf når du må, ellers lavt
    const candidates = [...legals].sort((a,b)=>compareCards(a,b,lead,trump));
    // høyeste i lovlige
    return candidates[candidates.length-1];
  }else{
    // dump lavest mulig lovlig
    const order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return [...legals].sort((a,b)=>order.indexOf(a.rank)-order.indexOf(b.rank))[0];
  }
}

function mediumAI(state, me){
  const hand = sortHandForDisplay(me.hand);
  const legals = legalCards(state, hand);
  const need = me.bid - me.tricks; // >0 må ta, <=0 bør unngå
  const lead = state.leadSuit ?? null;
  const trump = state.trump;
  // Ranger lovlige etter "vinnersjanse nå" via enkel sammenligning mot bordet
  const order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  function winsIfPlayed(card){
    const temp = state.currentTrick.map(x=>({playerIndex:x.playerIndex, card:x.card}));
    temp.push({playerIndex: me.index, card});
    const w = winnerOfTrick(temp, lead ?? card.suit, trump);
    return w===me.index;
  }
  const winning = legals.filter(winsIfPlayed)
                        .sort((a,b)=>order.indexOf(a.rank)-order.indexOf(b.rank)); // laveste vinnende
  const losing = legals.filter(c=>!winsIfPlayed(c))
                       .sort((a,b)=>order.indexOf(a.rank)-order.indexOf(b.rank)); // dump lavest
  if(need>0){
    if(winning.length) return winning[0];
    // hvis ingen garantert vinnere: spill høyeste i lovlig for å øke sjansen
    return [...legals].sort((a,b)=>order.indexOf(a.rank)-order.indexOf(b.rank)).at(-1);
  }else{
    if(losing.length) return losing[0];
    // må vi vinne: ta laveste vinnende
    if(winning.length) return winning[0];
    return legals[0];
  }
}

/* ——— Hard AI: Monte-Carlo-ish ———
   Idé: Sample tilfeldige fordelinger av ukjente kort konsistent med synlige/spilte kort.
   For hver lovlig kandidat beregn:
     pWinNow = andel simuleringer der dette kortet vinner stikket
     EVtowardBid = scorer å “vinne nå” vs “ikke vinne nå” gitt (bid - tricks) mål
   Velg kortet med høyest forventet verdi; tie-break: behold fleksibilitet (bevare trumf/høyder).
*/
function hardAI(state, me){
  const hand = sortHandForDisplay(me.hand);
  const legals = legalCards(state, hand);
  const samples = Math.max(200, 60 * state.players.length); // kan økes
  const trump = state.trump;
  const leadSuit = state.currentTrick.length ? state.leadSuit : null;
  const need = me.bid - me.tricks;

  // Finn ukjente kort (i andre hender + rest av stikk)
  const allCards = makeDeck();
  const seen = new Set([
    ...state.discarded.map(cardKey),
    ...state.currentTrick.map(x=>cardKey(x.card)),
    ...me.hand.map(cardKey),
  ]);
  const unknown = allCards.filter(c=>!seen.has(cardKey(c)));

  // Hvilke motspillere skal spille etter meg i dette stikket?
  const already = state.currentTrick.map(x=>x.playerIndex);
  const turnOrder = playersInTrickOrder(state.startingPlayer, state.players.length);
  const yetToPlay = turnOrder.filter(p=>!already.includes(p) && p!==me.index);

  const tally = new Map(legals.map(c=>[cardKey(c), {winNow:0, ev:0, sims:0, keepFlex: flexibilityScore(hand, c, trump)}]));

  for(let s=0;s<samples;s++){
    // Sample fordelinger: del "unknown" tilfeldig ut til andre hender med riktig håndstørrelse
    const hands = randomDealForOthers(state, me.index, unknown);

    for(const card of legals){
      // Simuler dette stikket under samplet
      const trick = state.currentTrick.map(x=>({playerIndex:x.playerIndex, card:x.card}));
      const lead = leadSuit ?? card.suit;
      trick.push({playerIndex: me.index, card});

      // spill resten i tilfeldig/grei heuristikk for motstandere
      for(const p of yetToPlay){
        const oppHand = hands.get(p);
        const oppLegals = legalGivenLead(oppHand, lead);
        const oppCard = heurOppPlay(oppLegals, lead, trump); // enkel motspillheuristikk
        // fjern fra hånd
        const idx = oppHand.findIndex(c=>cardKey(c)===cardKey(oppCard));
        oppHand.splice(idx,1);
        trick.push({playerIndex:p, card:oppCard});
      }
      const w = winnerOfTrick(trick, lead, trump);
      const willWin = (w===me.index);

      // Grov EV: hvis need>0 så er det bra å vinne; hvis need<=0 er det bra å tape
      const evNow = (need>0 ? (willWin?1:-0.5) : (willWin?-0.7:1));
      const t = tally.get(cardKey(card));
      t.winNow += willWin ? 1 : 0;
      t.ev += evNow;
      t.sims += 1;
    }
  }

  // Velg best EV; tie-break på fleksibilitet
  let best = null, bestScore = -1e9;
  for(const card of legals){
    const t = tally.get(cardKey(card));
    const meanEV = t.ev / Math.max(1,t.sims);
    const bonusFlex = 0.01 * t.keepFlex; // liten bias
    const score = meanEV + bonusFlex;
    if(score>bestScore){ bestScore=score; best=card; }
  }
  return best ?? mediumAI(state, me);
}

function flexibilityScore(hand, playCard, trump){
  // “Bevar fleksibilitet”: verdsett å beholde trumf og toppkort i skjeve farger
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
  // enkel heuristikk for motspill i simulering: lavt hvis du ikke kan vinne, ellers laveste vinnende
  const order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  function beats(a,b){ return compareCards(b,a,lead,trump)<0; } // b > a ?
  // sjekk om noe slår “beste på bordet” er vanskelig her; bruk grovt: spill lavt
  return [...legals].sort((a,b)=>order.indexOf(a.rank)-order.indexOf(b.rank))[0];
}

/*** Exponert API ***/
const AI_IMPL = {
  easy:  easyAI,
  medium: mediumAI,
  hard:  hardAI,
};

function suggest_play(state, hand){
  const me = state.players[state.turn];
  const impl = AI_IMPL[state.difficulty] ?? mediumAI;
  return impl(state, me);
}

/*** Hjelpefunksjoner som deles med script.js (minimal dupl.) ***/
function makeDeck(){
  const suits = ['♠','♥','♦','♣'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const d=[];
  for(const s of suits) for(const r of ranks) d.push({suit:s, rank:r});
  return d;
}

function playersInTrickOrder(starter, n){
  return Array.from({length:n},(_,i)=>(starter+i)%n);
}

function randomDealForOthers(state, meIndex, unknownCards){
  // Lag tilfeldige hender for alle andre med riktig antall kort igjen i runden
  // Kopier unknown og fyll ut etter behov.
  const hands = new Map();
  const copy = [...unknownCards];
  shuffle(copy);
  for(const p of state.players){
    if(p.index===meIndex) continue;
    const need = p.handSize - p.hand.length; // kort som ikke er delt enda (i stikkstart er dette 0)
    hands.set(p.index, [...p.hand]); // start med nåværende hånd
    while(hands.get(p.index).length < p.handSize && copy.length){
      hands.get(p.index).push(copy.pop());
    }
  }
  return hands;
}

function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];
  }
}

