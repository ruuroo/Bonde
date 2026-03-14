// script.js

(function () {
  "use strict";

  const {
    randomScenario,
    sortHand,
    cardLabel,
    getCardColor,
    SUIT_SYMBOLS,
    cardsToString,
  } = window.BondeEngine;

  const els = {
    playerCount: document.getElementById("playerCount"),
    cardsPerPlayer: document.getElementById("cardsPerPlayer"),
    mySeat: document.getElementById("mySeat"),
    leaderSeat: document.getElementById("leaderSeat"),

    dealButton: document.getElementById("dealButton"),
    analyzeButton: document.getElementById("analyzeButton"),

    trumpDisplay: document.getElementById("trumpDisplay"),
    seatDisplay: document.getElementById("seatDisplay"),
    leaderDisplay: document.getElementById("leaderDisplay"),

    handContainer: document.getElementById("handContainer"),

    expectedTricks: document.getElementById("expectedTricks"),
    recommendedBid: document.getElementById("recommendedBid"),
    handStrength: document.getElementById("handStrength"),
    analysisComment: document.getElementById("analysisComment"),

    distributionContainer: document.getElementById("distributionContainer"),
    debugOutput: document.getElementById("debugOutput"),
  };

  const state = {
    scenario: null,
    myHand: [],
    playerCount: 4,
    cardsPerPlayer: 5,
    mySeat: 0,
    leaderSeat: 0,
  };

  function seatName(index) {
    return `Spiller ${index + 1}`;
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

    return {
      playerCount,
      cardsPerPlayer,
      mySeat,
      leaderSeat,
    };
  }

  function updateSeatOptions(selectEl, playerCount, selectedValue) {
    const previous = Math.min(selectedValue, playerCount - 1);
    selectEl.innerHTML = "";

    for (let i = 0; i < playerCount; i++) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = seatName(i);
      if (i === previous) {
        option.selected = true;
      }
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

    updateStatusLabels();
  }

  function updateStatusLabels() {
    const values = getFormValues();
    els.seatDisplay.textContent = seatName(values.mySeat);
    els.leaderDisplay.textContent = seatName(values.leaderSeat);
  }

  function renderTrump(trumpSuit) {
    if (!trumpSuit) {
      els.trumpDisplay.textContent = "—";
      return;
    }

    const suitName = {
      S: "♠ Spar",
      H: "♥ Hjerter",
      D: "♦ Ruter",
      C: "♣ Kløver",
    };

    els.trumpDisplay.textContent = suitName[trumpSuit] || trumpSuit;
  }

  function createCardElement(card) {
    const cardEl = document.createElement("div");
    cardEl.className = `card ${getCardColor(card)}`;

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

    return cardEl;
  }

  function renderHand(hand) {
    els.handContainer.innerHTML = "";

    if (!hand || hand.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Ingen hånd trukket ennå.";
      els.handContainer.appendChild(empty);
      return;
    }

    hand.forEach((card) => {
      els.handContainer.appendChild(createCardElement(card));
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

  function renderDebug() {
    if (!state.scenario) {
      els.debugOutput.textContent = "Ingen data ennå.";
      return;
    }

    const handsText = state.scenario.hands
      .map((hand, i) => `${seatName(i)}: ${cardsToString(hand)}`)
      .join("\n");

    const debug = [
      `Antall spillere: ${state.playerCount}`,
      `Antall kort: ${state.cardsPerPlayer}`,
      `Min posisjon: ${seatName(state.mySeat)}`,
      `Startspiller: ${seatName(state.leaderSeat)}`,
      `Trumf: ${state.scenario.trumpSuit || "-"}`,
      "",
      handsText,
    ].join("\n");

    els.debugOutput.textContent = debug;
  }

  function dealNewHand() {
    const values = getFormValues();

    state.playerCount = values.playerCount;
    state.cardsPerPlayer = values.cardsPerPlayer;
    state.mySeat = values.mySeat;
    state.leaderSeat = values.leaderSeat;

    const scenario = randomScenario({
      playerCount: state.playerCount,
      cardsPerPlayer: state.cardsPerPlayer,
      includeTrump: true,
    });

    state.scenario = scenario;
    state.myHand = sortHand(scenario.hands[state.mySeat], scenario.trumpSuit);

    renderTrump(scenario.trumpSuit);
    renderHand(state.myHand);
    updateStatusLabels();
    resetAnalysisView();
    renderDebug();
  }

  function fallbackAnalyzeHand() {
    if (!state.scenario || !state.myHand.length) {
      els.analysisComment.textContent = "Trekk en hånd først.";
      return;
    }

    const trumpSuit = state.scenario.trumpSuit;
    const hand = state.myHand;

    let score = 0;

    for (const card of hand) {
      const isTrump = card.suit === trumpSuit;

      if (isTrump) {
        score += 0.9;
        if (card.rank === 14) score += 1.4;
        else if (card.rank === 13) score += 1.0;
        else if (card.rank === 12) score += 0.8;
        else if (card.rank === 11) score += 0.6;
        else if (card.rank >= 9) score += 0.4;
      } else {
        if (card.rank === 14) score += 0.95;
        else if (card.rank === 13) score += 0.55;
        else if (card.rank === 12) score += 0.3;
        else if (card.rank === 11) score += 0.2;
      }
    }

    const expectedTricks = Math.max(
      0,
      Math.min(state.cardsPerPlayer, score / 1.55)
    );

    const recommendedBid = Math.round(expectedTricks);

    els.expectedTricks.textContent = expectedTricks.toFixed(2);
    els.recommendedBid.textContent = String(recommendedBid);
    els.handStrength.textContent =
      score >= 4
        ? "Sterk"
        : score >= 2.5
        ? "Middels"
        : "Svak";

    els.analysisComment.textContent =
      "Foreløpig enkel analysemodell. Neste steg er å koble på Monte Carlo i ai.js.";

    const distribution = Array(state.cardsPerPlayer + 1).fill(0);
    const floor = Math.floor(expectedTricks);
    const ceil = Math.min(state.cardsPerPlayer, Math.ceil(expectedTricks));
    const frac = expectedTricks - floor;

    if (floor === ceil) {
      distribution[floor] = 1;
    } else {
      distribution[floor] = 1 - frac;
      distribution[ceil] = frac;
    }

    renderDistribution(distribution, state.cardsPerPlayer);
  }

  function analyzeHand() {
    if (!state.scenario || !state.myHand.length) {
      els.analysisComment.textContent = "Trekk en hånd først.";
      return;
    }

    const ai = window.BondeAI;

    if (ai && typeof ai.analyzeHand === "function") {
      const result = ai.analyzeHand({
        hand: state.myHand,
        trumpSuit: state.scenario.trumpSuit,
        playerCount: state.playerCount,
        cardsPerPlayer: state.cardsPerPlayer,
        mySeat: state.mySeat,
        leaderSeat: state.leaderSeat,
      });

      els.expectedTricks.textContent =
        result.expectedTricks != null ? Number(result.expectedTricks).toFixed(2) : "—";
      els.recommendedBid.textContent =
        result.recommendedBid != null ? String(result.recommendedBid) : "—";
      els.handStrength.textContent = result.handStrength || "—";
      els.analysisComment.textContent = result.comment || "Analyse fullført.";

      renderDistribution(result.distribution, state.cardsPerPlayer);
      return;
    }

    fallbackAnalyzeHand();
  }

  function bindEvents() {
    els.playerCount.addEventListener("change", syncFormWithPlayerCount);
    els.cardsPerPlayer.addEventListener("change", syncFormWithPlayerCount);
    els.mySeat.addEventListener("change", updateStatusLabels);
    els.leaderSeat.addEventListener("change", updateStatusLabels);

    els.dealButton.addEventListener("click", dealNewHand);
    els.analyzeButton.addEventListener("click", analyzeHand);
  }

  function init() {
    syncFormWithPlayerCount();
    resetAnalysisView();
    renderTrump(null);
    renderHand([]);
    renderDebug();
    bindEvents();
    dealNewHand();
  }

  init();
})();
