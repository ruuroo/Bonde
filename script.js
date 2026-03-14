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
    getValidCards,
    determineTrickWinner,
    playCardFromHand,
    nextPlayerIndex,
    cardEquals,
    cardsToString,
  } = Engine;

  const els = {
    playerCount: document.getElementById("playerCount"),
    cardsPerPlayer: document.getElementById("cardsPerPlayer"),
    mySeat: document.getElementById("mySeat"),
    dealerSeat: document.getElementById("dealerSeat"),

    startGameButton: document.getElementById("startGameButton"),
    startRoundButton: document.getElementById("startRoundButton"),
    analyzeButton: document.getElementById("analyzeButton"),
    nextRoundButton: document.getElementById("nextRoundButton"),
    playUpButton: document.getElementById("playUpButton"),

    phaseDisplay: document.getElementById("phaseDisplay"),
    trumpDisplay: document.getElementById("trumpDisplay"),
    turnDisplay: document.getElementById("turnDisplay"),

    seriesContainer: document.getElementById("seriesContainer"),
    scoreboardContainer: document.getElementById("scoreboardContainer"),
    biddingContainer: document.getElementById("biddingContainer"),
    tableContainer: document.getElementById("tableContainer"),
    handContainer: document.getElementById("handContainer"),

    expectedTricks: document.getElementById("expectedTricks"),
    recommendedBid: document.getElementById("recommendedBid"),
    handStrength: document.getElementById("handStrength"),
    analysisComment: document.getElementById("analysisComment"),
    distributionContainer: document.getElementById("distributionContainer"),
    playTipsContainer: document.getElementById("playTipsContainer"),

    roundSummaryContainer: document.getElementById("roundSummaryContainer"),
    debugOutput: document.getElementById("debugOutput"),
  };

  const state = {
    phase: "setup", // setup, bidding, playing, roundEnd, seriesEnd
    roundNumber: 1,

    playerCount: 4,
    mySeat: 0,
    dealerIndex: 0,

    seriesStartCards: 5,
    roundPlan: [],
    roundPlanIndex: -1,
    ascendingAvailable: false,
    ascendingMode: false,

    cardsPerPlayer: 5,
    leaderSeat: null,
    currentPlayerIndex: null,

    trumpSuit: null,
    trumpCard: null,

    players: [],
    scenario: null,

    currentTrick: [],
    completedTricks: [],
    lastTrickWinner: null,
  };

  function seatName(index) {
    return `Spiller ${index + 1}`;
  }

  function phaseName(phase) {
    if (phase === "setup") return "Oppsett";
    if (phase === "bidding") return "Budrunde";
    if (phase === "playing") return "Spiller runden";
    if (phase === "roundEnd") return "Runden er ferdig";
    if (phase === "seriesEnd") return "Spillserien er ferdig";
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
    const dealerRaw = els.dealerSeat.value;

    return {
      playerCount,
      cardsPerPlayer,
      mySeat,
      dealerRaw,
    };
  }

  function updateSeatOptions(selectEl, playerCount, selectedValue, includeRandom = false) {
    const current = includeRandom && selectedValue === "random"
      ? "random"
      : Math.min(Number(selectedValue), playerCount - 1);

    selectEl.innerHTML = "";

    if (includeRandom) {
      const option = document.createElement("option");
      option.value = "random";
      option.textContent = "Random";
      if (current === "random") option.selected = true;
      selectEl.appendChild(option);
    }

    for (let i = 0; i < playerCount; i++) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = seatName(i);
      if (i === current) option.selected = true;
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
    updateSeatOptions(els.mySeat, playerCount, els.mySeat.value);
    updateSeatOptions(els.dealerSeat, playerCount, els.dealerSeat.value, true);
  }

  function buildDescendingPlan(startCards) {
    const plan = [];
    for (let n = startCards; n >= 1; n--) {
      plan.push(n);
    }
    return plan;
  }

  function buildAscendingPlan(startCards) {
    const plan = [];
    for (let n = 2; n <= startCards; n++) {
      plan.push(n);
    }
    return plan;
  }

  function createPlayers(playerCount, humanSeat) {
    const previousScores = state.players.map((p) => p.score);
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
        score: previousScores[i] || 0,
      });
    }

    return players;
  }

  function chooseInitialDealer(dealerRaw, playerCount) {
    if (dealerRaw === "random") {
      return Math.floor(Math.random() * playerCount);
    }
    return Math.min(Number(dealerRaw), playerCount - 1);
  }

  function resetScoresForNewSeries() {
    state.players.forEach((p) => {
      p.score = 0;
    });
  }

  function startGameSeries() {
    const values = getFormValues();

    state.playerCount = values.playerCount;
    state.seriesStartCards = values.cardsPerPlayer;
    state.cardsPerPlayer = values.cardsPerPlayer;
    state.mySeat = values.mySeat;
    state.dealerIndex = chooseInitialDealer(values.dealerRaw, values.playerCount);

    state.roundPlan = buildDescendingPlan(state.seriesStartCards);
    state.roundPlanIndex = 0;
    state.roundNumber = 1;
    state.ascendingAvailable = false;
    state.ascendingMode = false;

    state.players = createPlayers(state.playerCount, state.mySeat);
    resetScoresForNewSeries();

    state.phase = "setup";
    state.currentTrick = [];
    state.completedTricks = [];
    state.leaderSeat = null;
    state.currentPlayerIndex = null;
    state.trumpSuit = null;
    state.trumpCard = null;
    state.lastTrickWinner = null;

    resetAnalysisView();
    renderAll();
  }

  function getCurrentRoundCardCount() {
    if (
      state.roundPlanIndex < 0 ||
      state.roundPlanIndex >= state.roundPlan.length
    ) {
      return null;
    }
    return state.roundPlan[state.roundPlanIndex];
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
    } else if (state.phase === "seriesEnd") {
      els.turnDisplay.textContent = "Velg neste steg";
    } else {
      els.turnDisplay.textContent = "—";
    }
  }

  function renderSeries() {
    els.seriesContainer.innerHTML = "";

    if (state.roundPlan.length === 0 || state.roundPlanIndex < 0) {
      els.seriesContainer.innerHTML =
        '<div class="empty-state">Ingen serie startet ennå.</div>';
      return;
    }

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "12px";

    const dealerText = state.dealerIndex != null ? seatName(state.dealerIndex) : "—";
    const leaderText = state.leaderSeat != null ? seatName(state.leaderSeat) : "—";
    const currentCards = getCurrentRoundCardCount();

    const top = document.createElement("div");
    top.style.display = "grid";
    top.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
    top.style.gap = "10px";

    [
      ["Serie", state.ascendingMode ? "Opp igjen" : "Nedover"],
      ["Runde", `${state.roundNumber}`],
      ["Kort nå", currentCards != null ? String(currentCards) : "—"],
      ["Dealer", dealerText],
    ].forEach(([label, value]) => {
      const box = document.createElement("div");
      box.style.padding = "12px";
      box.style.border = "1px solid var(--border)";
      box.style.borderRadius = "12px";
      box.style.background = "rgba(7, 17, 31, 0.72)";
      box.innerHTML = `<div style="color:var(--muted);font-size:0.9rem;">${label}</div><strong>${value}</strong>`;
      top.appendChild(box);
    });

    const planBox = document.createElement("div");
    planBox.style.padding = "12px";
    planBox.style.border = "1px solid var(--border)";
    planBox.style.borderRadius = "12px";
    planBox.style.background = "rgba(7, 17, 31, 0.72)";

    const planLine = state.roundPlan
      .map((value, i) => (i === state.roundPlanIndex ? `[${value}]` : String(value)))
      .join(" → ");

    planBox.innerHTML = `
      <div style="color:var(--muted);font-size:0.9rem;">Plan</div>
      <strong>${planLine}</strong>
      <div style="margin-top:8px;color:var(--muted);">Startspiller: ${leaderText}</div>
    `;

    wrap.appendChild(top);
    wrap.appendChild(planBox);

    els.seriesContainer.appendChild(wrap);
  }

  function createCardElement(card, options = {}) {
    const { selectable = false, disabled = false, onClick = null } = options;

    const cardEl = document.createElement("div");
    cardEl.className = `card ${getCardColor(card)}`;

    if (selectable) {
      cardEl.style.cursor = disabled ? "not-allowed" : "pointer";
      cardEl.style.opacity = disabled ? "0.45" : "1";
      if (!disabled) cardEl.style.borderColor = "#6aa7ff";
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
      row.style.gridTemplateColumns = "1.2fr 0.9fr 0.9fr 0.9fr";
      row.style.gap = "10px";
      row.style.alignItems = "center";
      row.style.padding = "12px";
      row.style.border = "1px solid var(--border)";
      row.style.borderRadius = "12px";
      row.style.background = "rgba(7, 17, 31, 0.72)";

      const isDealer = player.id === state.dealerIndex;
      row.innerHTML = `
        <div>
          <strong>${player.name}</strong>
          ${isDealer ? '<span style="margin-left:8px;color:var(--accent);font-size:0.9rem;">Dealer</span>' : ""}
        </div>
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
        '<div class="empty-state">Start en spillserie og deretter en runde.</div>';
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
      if (human && human.bid == null) {
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

  function buildSeatOrderFromLeader() {
    const order = [];
    let current = state.leaderSeat ?? 0;
    for (let i = 0; i < state.playerCount; i++) {
      order.push(current);
      current = nextPlayerIndex(current, state.playerCount);
    }
    return order;
  }

  function renderTable() {
    els.tableContainer.innerHTML = "";

    if (state.players.length === 0) {
      els.tableContainer.innerHTML =
        '<div class="empty-state">Ingen spillere tilgjengelig.</div>';
      return;
    }

    const order = buildSeatOrderFromLeader();

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "repeat(auto-fit, minmax(160px, 1fr))";
    wrap.style.gap = "12px";

    order.forEach((playerId) => {
      const player = state.players[playerId];
      const play = state.currentTrick.find((p) => p.playerIndex === playerId);

      const box = document.createElement("div");
      box.style.padding = "12px";
      box.style.border = "1px solid var(--border)";
      box.style.borderRadius = "14px";
      box.style.background = "rgba(7, 17, 31, 0.72)";
      box.style.display = "flex";
      box.style.flexDirection = "column";
      box.style.alignItems = "center";
      box.style.gap = "8px";
      box.style.minHeight = "180px";

      let badge = "";
      if (player.id === state.dealerIndex) badge += " Dealer";
      if (player.id === state.currentPlayerIndex && state.phase === "playing") badge += " • Tur";
      if (player.id === state.leaderSeat) badge += " • Starter";

      const title = document.createElement("div");
      title.style.textAlign = "center";
      title.innerHTML = `
        <strong>${player.name}</strong>
        <div style="color:var(--muted);font-size:0.9rem;">Bud: ${player.bid ?? "—"} | Stikk: ${player.tricksWon}</div>
        <div style="color:var(--accent);font-size:0.85rem;">${badge.trim() || "&nbsp;"}</div>
      `;

      box.appendChild(title);

      if (play) {
        box.appendChild(createCardElement(play.card));
      } else {
        const placeholder = document.createElement("div");
        placeholder.style.flex = "1";
        placeholder.style.display = "grid";
        placeholder.style.placeItems = "center";
        placeholder.style.color = "var(--muted)";
        placeholder.textContent = "Ingen kort spilt";
        box.appendChild(placeholder);
      }

      wrap.appendChild(box);
    });

    if (state.currentTrick.length === 0) {
      const info = document.createElement("div");
      info.className = "empty-state";
      info.style.marginBottom = "12px";
      info.textContent = "Ingen kort på bordet ennå.";
      els.tableContainer.appendChild(info);
    }

    els.tableContainer.appendChild(wrap);

    if (state.lastTrickWinner != null) {
      const winner = document.createElement("div");
      winner.style.marginTop = "12px";
      winner.style.color = "var(--muted)";
      winner.textContent = `Siste stikk vunnet av: ${state.players[state.lastTrickWinner].name}`;
      els.tableContainer.appendChild(winner);
    }
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
    const validCards =
      state.phase === "playing" && state.currentPlayerIndex === state.mySeat
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

    if (els.playTipsContainer) {
      els.playTipsContainer.innerHTML =
        '<div class="empty-state">Tips vises her etter analyse.</div>';
    }
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

  function renderPlayTips(tips) {
    if (!els.playTipsContainer) return;

    els.playTipsContainer.innerHTML = "";

    if (!tips || tips.length === 0) {
      els.playTipsContainer.innerHTML =
        '<div class="empty-state">Ingen tips tilgjengelig.</div>';
      return;
    }

    const list = document.createElement("div");
    list.style.display = "grid";
    list.style.gap = "8px";

    tips.forEach((tip) => {
      const item = document.createElement("div");
      item.style.padding = "10px 12px";
      item.style.border = "1px solid var(--border)";
      item.style.borderRadius = "10px";
      item.style.background = "rgba(7, 17, 31, 0.72)";
      item.textContent = tip;
      list.appendChild(item);
    });

    els.playTipsContainer.appendChild(list);
  }

  function renderRoundSummary() {
    els.roundSummaryContainer.innerHTML = "";

    if (state.phase !== "roundEnd" && state.phase !== "seriesEnd") {
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

      const roundPoints =
        player.bid === player.tricksWon
          ? player.bid === 0
            ? 5
            : 10 + player.bid
          : 0;

      title.innerHTML = `
        <strong>${player.name}</strong>
        – Bud: <strong>${player.bid}</strong>
        – Stikk: <strong>${player.tricksWon}</strong>
        – Runde: <strong>${roundPoints}</strong>
        – Totalt: <strong>${player.score}</strong>
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
      dealerIndex: state.dealerIndex,
      leaderSeat: state.leaderSeat,
      currentPlayerIndex: state.currentPlayerIndex,
      cardsPerPlayer: state.cardsPerPlayer,
      roundPlan: state.roundPlan,
      roundPlanIndex: state.roundPlanIndex,
      ascendingMode: state.ascendingMode,
      trumpSuit: state.trumpSuit,
      humanHand:
        state.players[state.mySeat] &&
        state.players[state.mySeat].hand
          ? cardsToString(state.players[state.mySeat].hand)
          : "",
      currentTrick: state.currentTrick.map((play) => ({
        player: state.players[play.playerIndex]?.name,
        card: `${play.card.suit}${play.card.rank}`,
      })),
    };

    els.debugOutput.textContent = JSON.stringify(debug, null, 2);
  }

  function renderAll() {
    renderStatus();
    renderSeries();
    renderScoreboard();
    renderBidding();
    renderTable();
    renderHand();
    renderRoundSummary();
    renderDebug();

    els.nextRoundButton.hidden = state.phase !== "roundEnd";
    els.playUpButton.hidden = !(state.phase === "seriesEnd" && state.ascendingAvailable);
  }

  function startRound() {
    if (state.roundPlan.length === 0) {
      startGameSeries();
    }

    const currentCards = getCurrentRoundCardCount();
    if (currentCards == null) {
      return;
    }

    state.cardsPerPlayer = currentCards;
    state.currentPlayerIndex = null;
    state.currentTrick = [];
    state.completedTricks = [];
    state.lastTrickWinner = null;
    state.phase = "bidding";
    state.leaderSeat = null;

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

  function getRightOfDealerPriority() {
    const order = [];
    let idx = (state.dealerIndex - 1 + state.playerCount) % state.playerCount;

    for (let i = 0; i < state.playerCount; i++) {
      order.push(idx);
      idx = (idx - 1 + state.playerCount) % state.playerCount;
    }

    return order;
  }

  function determineLeaderFromBids() {
    const maxBid = Math.max(...state.players.map((p) => p.bid ?? 0));
    const tiedIds = state.players
      .filter((p) => (p.bid ?? 0) === maxBid)
      .map((p) => p.id);

    const priority = getRightOfDealerPriority();
    return priority.find((id) => tiedIds.includes(id));
  }

  function submitHumanBid(bid) {
    const human = state.players[state.mySeat];
    human.bid = bid;

    state.leaderSeat = determineLeaderFromBids();
    state.phase = "playing";
    state.currentPlayerIndex = state.leaderSeat;

    renderAll();
    runBotsUntilHuman();
  }

  function defaultPlayTips(hand, trumpSuit) {
    const tips = [];
    const trumpCards = hand.filter((c) => c.suit === trumpSuit).sort((a, b) => b.rank - a.rank);
    const aces = hand.filter((c) => c.rank === 14 && c.suit !== trumpSuit);

    if (trumpCards.length >= 3) {
      tips.push("Du har en del trumf. Vurder å bruke trumf aktivt for å kontrollere stikkene.");
    }
    if (trumpCards.length > 0 && trumpCards[0].rank >= 13) {
      tips.push("Du har høy trumf. Det kan være smart å ta et sikkert stikk tidlig.");
    }
    if (aces.length > 0) {
      tips.push("Du har ess i sidefarge. Prøv å hente sikre stikk før du mister initiativet.");
    }
    if (tips.length === 0) {
      tips.push("Hånda ser ikke veldig tung ut. Spill kontrollert og unngå å gi bort unødige stikk.");
    }
    tips.push("Følg med på hvilke farger motspillerne mangler. Det avgjør ofte når trumf bør brukes.");
    return tips.slice(0, 4);
  }

  function analyzeHand() {
    const human = state.players[state.mySeat];
    if (!human || human.hand.length === 0) {
      els.analysisComment.textContent = "Start en runde først.";
      return;
    }

    if (!(AI && typeof AI.analyzeHand === "function")) {
      els.analysisComment.textContent = "ai.js er ikke lastet riktig.";
      renderPlayTips(defaultPlayTips(human.hand, state.trumpSuit));
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
    renderPlayTips(result.playTips || defaultPlayTips(human.hand, state.trumpSuit));
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

    const winningOptions = validCards
      .filter((card) => {
        const temp = [...state.currentTrick, { playerIndex: player.id, card }];
        const result = determineTrickWinner(temp, trumpSuit);
        return result.winnerPlayerIndex === player.id;
      })
      .sort((a, b) => a.rank - b.rank);

    if (player.tricksWon < (player.bid ?? 0)) {
      if (winningOptions.length > 0) {
        return winningOptions[0];
      }
      return sortedLowToHigh[0];
    }

    const nonWinning = validCards
      .filter((card) => {
        const temp = [...state.currentTrick, { playerIndex: player.id, card }];
        const result = determineTrickWinner(temp, trumpSuit);
        return result.winnerPlayerIndex !== player.id;
      })
      .sort((a, b) => a.rank - b.rank);

    if (nonWinning.length > 0) {
      return nonWinning[0];
    }

    return sortedLowToHigh[0];
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
    state.lastTrickWinner = winnerIndex;
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
      }
    });

    renderAll();
  }

  function advanceDealer() {
    state.dealerIndex = nextPlayerIndex(state.dealerIndex, state.playerCount);
  }

  function nextRound() {
    if (state.phase !== "roundEnd") return;

    advanceDealer();
    state.roundPlanIndex += 1;
    state.roundNumber += 1;

    if (state.roundPlanIndex >= state.roundPlan.length) {
      if (!state.ascendingMode && state.seriesStartCards > 1) {
        state.phase = "seriesEnd";
        state.ascendingAvailable = true;
        renderAll();
        return;
      }

      state.phase = "seriesEnd";
      state.ascendingAvailable = false;
      renderAll();
      return;
    }

    startRound();
  }

  function playUpAgain() {
    state.ascendingMode = true;
    state.ascendingAvailable = false;
    state.roundPlan = buildAscendingPlan(state.seriesStartCards);
    state.roundPlanIndex = 0;
    state.roundNumber += 1;
    advanceDealer();
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

    els.startGameButton.addEventListener("click", startGameSeries);
    els.startRoundButton.addEventListener("click", startRound);
    els.analyzeButton.addEventListener("click", analyzeHand);
    els.nextRoundButton.addEventListener("click", nextRound);
    els.playUpButton.addEventListener("click", playUpAgain);
  }

  function init() {
    syncFormWithPlayerCount();
    state.players = createPlayers(4, 0);
    resetAnalysisView();
    renderAll();
    bindEvents();
  }

  init();
})();
