// script.js

(function () {
  "use strict";

  const Engine = window.BondeEngine;
  const AI = window.BondeAI;

  const {
    randomScenario,
    sortHand,
    cardLabel,
    getCardColor,
    SUIT_SYMBOLS,
    cardsToString,
    getValidCards,
    determineTrickWinner,
    playCardFromHand,
    nextPlayerIndex,
    cardEquals,
  } = Engine;

  const els = {
    playerCount: document.getElementById("playerCount"),
    cardsPerPlayer: document.getElementById("cardsPerPlayer"),
    mySeat: document.getElementById("mySeat"),
    leaderSeat: document.getElementById("leaderSeat"),

    startRoundButton: document.getElementById("startRoundButton"),
    analyzeButton: document.getElementById("analyzeButton"),
    nextRoundButton: document.getElementById("nextRoundButton"),

    phaseDisplay: document.getElementById("phaseDisplay"),
    trumpDisplay: document.getElementById("trumpDisplay"),
    turnDisplay: document.getElementById("turnDisplay"),

    scoreboardContainer: document.getElementById("scoreboardContainer"),
    biddingContainer: document.getElementById("biddingContainer"),
    tableContainer: document.getElementById("tableContainer"),
    handContainer: document.getElementById("handContainer"),

    expectedTricks: document.getElementById("expectedTricks"),
    recommendedBid: document.getElementById("recommendedBid"),
    handStrength: document.getElementById("handStrength"),
    analysisComment: document.getElementById("analysisComment"),
    distributionContainer: document.getElementById("distributionContainer"),

    roundSummaryContainer: document.getElementById("roundSummaryContainer"),
    debugOutput: document.getElementById("debugOutput"),
  };

  const state = {
    phase: "setup",
    roundNumber: 1,
    playerCount: 4,
    cardsPerPlayer: 5,
    mySeat: 0,
    leaderSeat: 0,
    dealerIndex: null,
    currentPlayerIndex: null,
    trumpSuit: null,
    trumpCard: null,
    players: [],
    scenario: null,
    currentTrick: [],
    completedTricks: [],
  };

  function seatName(index) {
    return `Spiller ${index + 1}`;
  }

  function phaseName(phase) {
    if (phase === "setup") return "Oppsett";
    if (phase === "bidding") return "Budrunde";
    if (phase === "playing") return "Spiller runden";
    if (phase === "roundEnd") return "Runden er ferdig";
    return phase;
  }

  function clampCardsPerPlayer(playerCount, requested) {
    const max = Math.floor(52 / playerCount);
    return Math.max(1, Math.min(max, requested));
  }

  function getFormValues() {
    const playerCount = Number(els.playerCount.value);
    const cardsPerPlayer = clampCardsPerPlayer(
      playerCount,
      Number(els.cardsPerPlayer.value)
    );
    const mySeat = Math.min(Number(els.mySeat.value), playerCount - 1);
    const leaderSeat = Math.min(Number(els.leaderSeat.value), playerCount - 1);

    return { playerCount, cardsPerPlayer, mySeat, leaderSeat };
  }

  function updateSeatOptions(selectEl, playerCount, selectedValue) {
    const safe = Math.min(selectedValue, playerCount - 1);
    selectEl.innerHTML = "";
    for (let i = 0; i < playerCount; i++) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = seatName(i);
      if (i === safe) option.selected = true;
      selectEl.appendChild(option);
    }
  }

  function syncFormWithPlayerCount() {
    const playerCount = Number(els.playerCount.value);
    const cardsPerPlayer = clampCardsPerPlayer(
      playerCount,
      Number(els.cardsPerPlayer.value)
    );

    els.cardsPerPlayer.value = String(cardsPerPlayer);
    updateSeatOptions(els.mySeat, playerCount, Number(els.mySeat.value));
    updateSeatOptions(els.leaderSeat, playerCount, Number(els.leaderSeat.value));
  }

  function createPlayers(playerCount, humanSeat) {
    const players = [];
    for (let i = 0; i < playerCount; i++) {
      players.push({
        id: i,
        name: i === humanSeat ? "Deg" : `Bot ${i + 1}`,
        isHuman: i === humanSeat,
        hand: [],
        originalHand: [],
        bid: null,
        tricksWon: 0,
        score: state.players[i]?.score || 0,
      });
    }
    return players;
  }

  function renderTrump() {
    if (!state.trumpSuit) {
      els.trumpDisplay.textContent = "—";
      return;
    }

    const suitName = {
      S: "♠ Spar",
      H: "♥ Hjerter",
      D: "♦ Ruter",
      C: "♣ Kløver",
    };

    els.trumpDisplay.textContent = suitName[state.trumpSuit] || state.trumpSuit;
  }

  function renderStatus() {
    els.phaseDisplay.textContent = phaseName(state.phase);
    renderTrump();

    if (state.phase === "playing" && state.currentPlayerIndex != null) {
      els.turnDisplay.textContent = state.players[state.currentPlayerIndex].name;
    } else if (state.phase === "bidding") {
      els.turnDisplay.textContent = "Meld bud";
    } else if (state.phase === "roundEnd") {
      els.turnDisplay.textContent = "Runden ferdig";
    } else {
      els.turnDisplay.textContent = "—";
    }
  }

  function createCardElement(card, options = {}) {
    const { selectable = false, disabled = false, onClick = null } = options;

    const cardEl = document.createElement("div");
    cardEl.className = `card ${getCardColor(card)}`;

    if (selectable) {
      cardEl.style.cursor = disabled ? "not-allowed" : "pointer";
      cardEl.style.opacity = disabled ? "0.45" : "1";
      if (!disabled) {
        cardEl.style.borderColor = "#6aa7ff";
      }
    }

    const top = document.createElement("div");
    top.className = "card-corner";
    top.innerHTML = `
      <span class="card-rank">${cardLabel(card.rank)}</span>
      <span class="card-suit">${SUIT_SYMBOLS[card.suit]}</span>
    `;

    const center = document.createElement("div");
    center.className = "card-center";
    center.textContent = SUIT_SYMBOLS[card.suit];

    const bottom = document.createElement("div");
    bottom.className = "card-corner";
    bottom.style.alignItems = "flex-end";
    bottom.innerHTML = `
      <span class="card-suit">${SUIT_SYMBOLS[card.suit]}</span>
      <span class="card-rank">${cardLabel(card.rank)}</span>
    `;

    cardEl.appendChild(top);
    cardEl.appendChild(center);
    cardEl.appendChild(bottom);

    if (selectable && !disabled && onClick) {
      cardEl.addEventListener("click", onClick);
    }

    return cardEl;
  }

  function renderScoreboard() {
    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "10px";

    state.players.forEach((player) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1.3fr 0.8fr 0.8fr 0.8fr";
      row.style.gap = "10px";
      row.style.alignItems = "center";
      row.style.padding = "12px";
      row.style.border = "1px solid var(--border)";
      row.style.borderRadius = "12px";
      row.style.background = "rgba(7, 17, 31, 0.72)";

      row.innerHTML = `
        <div><strong>${player.name}</strong></div>
        <div>Bud: <strong>${player.bid ?? "—"}</strong></div>
        <div>Stikk: <strong>${player.tricksWon}</strong></div>
        <div>Poeng: <strong>${player.score}</strong></div>
      `;

      wrap.appendChild(row);
    });

    els.scoreboardContainer.innerHTML = "";
    els.scoreboardContainer.appendChild(wrap);
  }

  function renderBidding() {
    els.biddingContainer.innerHTML = "";

    if (state.phase === "setup") {
      els.biddingContainer.innerHTML =
        '<div class="empty-state">Start en runde for å melde bud.</div>';
      return;
    }

    const info = document.createElement("div");
    info.style.display = "grid";
    info.style.gap = "10px";

    state.players.forEach((player) => {
      const row = document.createElement("div");
      row.style.padding = "12px";
      row.style.border = "1px solid var(--border)";
      row.style.borderRadius = "12px";
      row.style.background = "rgba(7, 17, 31, 0.72)";
      row.innerHTML = `<strong>${player.name}</strong> – Bud: <strong>${player.bid ?? "—"}</strong>`;
      info.appendChild(row);
    });

    els.biddingContainer.appendChild(info);

    if (state.phase === "bidding") {
      const human = state.players[state.mySeat];

      if (human.bid == null) {
        const controls = document.createElement("div");
        controls.style.marginTop = "14px";
        controls.style.display = "flex";
        controls.style.flexWrap = "wrap";
        controls.style.gap = "10px";

        for (let bid = 0; bid <= state.cardsPerPlayer; bid++) {
          const btn = document.createElement("button");
          btn.textContent = String(bid);
          btn.addEventListener("click", () => submitHumanBid(bid));
          controls.appendChild(btn);
        }

        els.biddingContainer.appendChild(controls);
      }
    }
  }

  function renderTable() {
    els.tableContainer.innerHTML = "";

    if (state.currentTrick.length === 0) {
      els.tableContainer.innerHTML =
        '<div class="empty-state">Ingen kort på bordet ennå.</div>';
      return;
    }

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexWrap = "wrap";
    wrap.style.gap = "14px";

    state.currentTrick.forEach((play) => {
      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.flexDirection = "column";
      item.style.gap = "8px";
      item.style.alignItems = "center";

      const name = document.createElement("div");
      name.textContent = state.players[play.playerIndex].name;
      name.style.color = "var(--muted)";

      item.appendChild(name);
      item.appendChild(createCardElement(play.card));
      wrap.appendChild(item);
    });

    els.tableContainer.appendChild(wrap);
  }

  function renderHand() {
    els.handContainer.innerHTML = "";

    const human = state.players[state.mySeat];
    if (!human || human.hand.length === 0) {
      els.handContainer.innerHTML =
        '<div class="empty-state">Ingen hånd tilgjengelig.</div>';
      return;
    }

    const leadSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
    const validCards = state.phase === "playing" && state.currentPlayerIndex === state.mySeat
      ? getValidCards(human.hand, leadSuit)
      : [];

    const sorted = sortHand(human.hand, state.trumpSuit);

    sorted.forEach((card) => {
      const disabled =
        !(state.phase === "playing" && state.currentPlayerIndex === state.mySeat) ||
        !validCards.some((valid) => cardEquals(valid, card));

      const cardEl = createCardElement(card, {
        selectable: true,
        disabled,
        onClick: () => playHumanCard(card),
      });

      els.handContainer.appendChild(cardEl);
    });
  }

  function resetAnalysisView() {
    els.expectedTricks.textContent = "—";
    els.recommendedBid.textContent = "—";
    els.handStrength.textContent = "—";
    els.analysisComment.textContent = "Ingen analyse kjørt ennå.";
    els.distributionContainer.innerHTML =
      '<div class="empty-state">Fordeling vises her etter analyse.</div>';
  }

  function renderDistribution(distribution, cardsPerPlayer) {
    els.distributionContainer.innerHTML = "";

    if (!distribution || distribution.length === 0) {
      els.distributionContainer.innerHTML =
        '<div class="empty-state">Ingen sannsynlighetsfordeling tilgjengelig.</div>';
      return;
    }

    for (let tricks = 0; tricks <= cardsPerPlayer; tricks++) {
      const probability = distribution[tricks] || 0;

      const row = document.createElement("div");
      row.className = "dist-row";

      const label = document.createElement("div");
      label.className = "dist-label";
      label.textContent = `${tricks}`;

      const barWrap = document.createElement("div");
      barWrap.className = "dist-bar-wrap";

      const bar = document.createElement("div");
      bar.className = "dist-bar";
      bar.style.width = `${Math.max(0, Math.min(100, probability * 100))}%`;

      barWrap.appendChild(bar);

      const value = document.createElement("div");
      value.className = "dist-value";
      value.textContent = `${(probability * 100).toFixed(1)}%`;

      row.appendChild(label);
      row.appendChild(barWrap);
      row.appendChild(value);

      els.distributionContainer.appendChild(row);
    }
  }

  function renderRoundSummary() {
    els.roundSummaryContainer.innerHTML = "";

    if (state.phase !== "roundEnd") {
      els.roundSummaryContainer.innerHTML =
        '<div class="empty-state">Vises når runden er ferdig.</div>';
      return;
    }

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "16px";

    state.players.forEach((player) => {
      const box = document.createElement("div");
      box.style.padding = "14px";
      box.style.border = "1px solid var(--border)";
      box.style.borderRadius = "14px";
      box.style.background = "rgba(7, 17, 31, 0.72)";

      const title = document.createElement("div");
      title.style.marginBottom = "10px";
      title.innerHTML = `
        <strong>${player.name}</strong>
        – Bud: <strong>${player.bid}</strong>
        – Stikk: <strong>${player.tricksWon}</strong>
        – Poeng: <strong>${player.score}</strong>
      `;

      const handWrap = document.createElement("div");
      handWrap.style.display = "flex";
      handWrap.style.flexWrap = "wrap";
      handWrap.style.gap = "10px";

      sortHand(player.originalHand, state.trumpSuit).forEach((card) => {
        handWrap.appendChild(createCardElement(card));
      });

      box.appendChild(title);
      box.appendChild(handWrap);
      wrap.appendChild(box);
    });

    els.roundSummaryContainer.appendChild(wrap);
  }

  function renderDebug() {
    const debug = {
      phase: state.phase,
      roundNumber: state.roundNumber,
      currentPlayerIndex: state.currentPlayerIndex,
      leaderSeat: state.leaderSeat,
      trumpSuit: state.trumpSuit,
      currentTrick: state.currentTrick.map((play) => ({
        player: state.players[play.playerIndex].name,
        card: `${play.card.suit}${play.card.rank}`,
      })),
    };

    els.debugOutput.textContent = JSON.stringify(debug, null, 2);
  }

  function renderAll() {
    renderStatus();
    renderScoreboard();
    renderBidding();
    renderTable();
    renderHand();
    renderRoundSummary();
    renderDebug();
    els.nextRoundButton.hidden = state.phase !== "roundEnd";
  }

  function startRound() {
    const values = getFormValues();

    state.playerCount = values.playerCount;
    state.cardsPerPlayer = values.cardsPerPlayer;
    state.mySeat = values.mySeat;
    state.leaderSeat = values.leaderSeat;
    state.dealerIndex = (state.leaderSeat - 1 + state.playerCount) % state.playerCount;
    state.currentPlayerIndex = null;
    state.currentTrick = [];
    state.completedTricks = [];
    state.phase = "bidding";

    state.players = createPlayers(state.playerCount, state.mySeat);

    const scenario = randomScenario({
      playerCount: state.playerCount,
      cardsPerPlayer: state.cardsPerPlayer,
      includeTrump: true,
    });

    state.scenario = scenario;
    state.trumpSuit = scenario.trumpSuit;
    state.trumpCard = scenario.trumpCard;

    state.players.forEach((player, index) => {
      player.hand = sortHand(scenario.hands[index], state.trumpSuit);
      player.originalHand = sortHand(scenario.hands[index], state.trumpSuit);
      player.bid = null;
      player.tricksWon = 0;
    });

    autoBidForBots();
    resetAnalysisView();
    renderAll();
  }

function fallbackBotBid(player) {
  const trumpCount = player.hand.filter((c) => c.suit === state.trumpSuit).length;
  const aces = player.hand.filter((c) => c.rank === 14).length;
  const kings = player.hand.filter((c) => c.rank === 13).length;

  let estimate = 0;
  estimate += trumpCount * 0.7;
  estimate += aces * 0.9;
  estimate += kings * 0.35;

  return Math.max(0, Math.min(state.cardsPerPlayer, Math.round(estimate / 1.2)));
}

function autoBidForBots() {
  state.players.forEach((player) => {
    if (player.isHuman) return;

    if (AI && typeof AI.analyzeHand === "function") {
      const result = AI.analyzeHand({
        hand: player.hand,
        trumpSuit: state.trumpSuit,
        playerCount: state.playerCount,
        cardsPerPlayer: state.cardsPerPlayer,
      });
      player.bid = result.recommendedBid;
    } else {
      player.bid = fallbackBotBid(player);
    }
  });
}

  function submitHumanBid(bid) {
    const human = state.players[state.mySeat];
    human.bid = bid;
    state.phase = "playing";
    state.currentPlayerIndex = state.leaderSeat;
    renderAll();
    runBotsUntilHuman();
  }

function analyzeHand() {
  const human = state.players[state.mySeat];
  if (!human || human.hand.length === 0) {
    els.analysisComment.textContent = "Start en runde først.";
    return;
  }

  if (!(AI && typeof AI.analyzeHand === "function")) {
    els.analysisComment.textContent = "ai.js er ikke lastet riktig.";
    return;
  }

  const result = AI.analyzeHand({
    hand: human.hand,
    trumpSuit: state.trumpSuit,
    playerCount: state.playerCount,
    cardsPerPlayer: state.cardsPerPlayer,
  });

  els.expectedTricks.textContent = Number(result.expectedTricks).toFixed(2);
  els.recommendedBid.textContent = String(result.recommendedBid);
  els.handStrength.textContent = result.handStrength;
  els.analysisComment.textContent = result.comment || "Analyse fullført.";
  renderDistribution(result.distribution, state.cardsPerPlayer);
}

  function chooseBotCard(player) {
    const leadSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
    const validCards = getValidCards(player.hand, leadSuit);
    const trumpSuit = state.trumpSuit;

    const sortedLowToHigh = [...validCards].sort((a, b) => a.rank - b.rank);

    if (state.currentTrick.length === 0) {
      const strong = [...validCards]
        .filter((c) => c.suit === trumpSuit || c.rank >= 13)
        .sort((a, b) => b.rank - a.rank);

      if (player.tricksWon < (player.bid ?? 0) && strong.length > 0) {
        return strong[0];
      }

      return sortedLowToHigh[0];
    }

    const hypotheticalTrick = [...state.currentTrick];
    const currentlyWinning = determineTrickWinner(hypotheticalTrick, trumpSuit).winningCard;

    const winningOptions = validCards.filter((card) => {
      const temp = [...state.currentTrick, { playerIndex: player.id, card }];
      const result = determineTrickWinner(temp, trumpSuit);
      return result.winnerPlayerIndex === player.id;
    }).sort((a, b) => a.rank - b.rank);

    if (player.tricksWon < (player.bid ?? 0)) {
      if (winningOptions.length > 0) {
        return winningOptions[0];
      }
      return sortedLowToHigh[0];
    }

    const nonWinning = validCards.filter((card) => {
      const temp = [...state.currentTrick, { playerIndex: player.id, card }];
      const result = determineTrickWinner(temp, trumpSuit);
      return result.winnerPlayerIndex !== player.id;
    }).sort((a, b) => a.rank - b.rank);

    if (nonWinning.length > 0) {
      return nonWinning[0];
    }

    return sortedLowToHigh[0] || currentlyWinning;
  }

  function placeCard(playerIndex, card) {
    const player = state.players[playerIndex];
    const leadSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;

    player.hand = playCardFromHand(player.hand, card, leadSuit);
    state.currentTrick.push({ playerIndex, card });
  }

  function playHumanCard(card) {
    if (state.phase !== "playing") return;
    if (state.currentPlayerIndex !== state.mySeat) return;

    const human = state.players[state.mySeat];
    const leadSuit = state.currentTrick.length > 0 ? state.currentTrick[0].card.suit : null;
    const validCards = getValidCards(human.hand, leadSuit);

    const allowed = validCards.some((valid) => cardEquals(valid, card));
    if (!allowed) return;

    placeCard(state.mySeat, card);
    advanceAfterPlay();
  }

  function playBotTurn() {
    const player = state.players[state.currentPlayerIndex];
    if (!player || player.isHuman) return;

    const card = chooseBotCard(player);
    placeCard(player.id, card);
    advanceAfterPlay();
  }

  function advanceAfterPlay() {
    if (state.currentTrick.length === state.playerCount) {
      resolveTrick();
      return;
    }

    state.currentPlayerIndex = nextPlayerIndex(state.currentPlayerIndex, state.playerCount);
    renderAll();
    runBotsUntilHuman();
  }

  function resolveTrick() {
    const result = determineTrickWinner(state.currentTrick, state.trumpSuit);
    const winnerIndex = result.winnerPlayerIndex;
    state.players[winnerIndex].tricksWon += 1;
    state.completedTricks.push([...state.currentTrick]);
    state.currentTrick = [];
    state.currentPlayerIndex = winnerIndex;

    const cardsLeft = state.players[0].hand.length;
    if (cardsLeft === 0) {
      finishRound();
      return;
    }

    renderAll();
    runBotsUntilHuman();
  }

  function finishRound() {
    state.phase = "roundEnd";

    state.players.forEach((player) => {
      if (player.bid === player.tricksWon) {
        if (player.bid === 0) {
          player.score += 5;
        } else {
          player.score += 10 + player.bid;
        }
      } else {
        player.score -= Math.abs(player.bid - player.tricksWon);
      }
    });

    renderAll();
  }

  function nextRound() {
    state.roundNumber += 1;
    startRound();
  }

  function runBotsUntilHuman() {
    while (
      state.phase === "playing" &&
      state.currentPlayerIndex != null &&
      !state.players[state.currentPlayerIndex].isHuman
    ) {
      playBotTurn();
    }

    renderAll();
  }

  function bindEvents() {
    els.playerCount.addEventListener("change", syncFormWithPlayerCount);
    els.cardsPerPlayer.addEventListener("change", syncFormWithPlayerCount);
    els.startRoundButton.addEventListener("click", startRound);
    els.analyzeButton.addEventListener("click", analyzeHand);
    els.nextRoundButton.addEventListener("click", nextRound);
  }

  function init() {
    syncFormWithPlayerCount();
    resetAnalysisView();
    state.players = createPlayers(4, 0);
    renderAll();
    bindEvents();
  }

  init();
})();
