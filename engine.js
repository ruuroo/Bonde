// engine.js

(function () {
  "use strict";

  const SUITS = ["S", "H", "D", "C"];
  const SUIT_SYMBOLS = {
    S: "♠",
    H: "♥",
    D: "♦",
    C: "♣",
  };

  const SUIT_NAMES = {
    S: "Spar",
    H: "Hjerter",
    D: "Ruter",
    C: "Kløver",
  };

  const SUIT_COLORS = {
    S: "black",
    C: "black",
    H: "red",
    D: "red",
  };

  const RANK_LABELS = {
    11: "J",
    12: "Q",
    13: "K",
    14: "A",
  };

  function createCard(suit, rank) {
    if (!SUITS.includes(suit)) {
      throw new Error(`Ugyldig sort: ${suit}`);
    }
    if (!Number.isInteger(rank) || rank < 2 || rank > 14) {
      throw new Error(`Ugyldig rank: ${rank}`);
    }

    return { suit, rank };
  }

  function cloneCard(card) {
    return { suit: card.suit, rank: card.rank };
  }

  function cloneCards(cards) {
    return cards.map(cloneCard);
  }

  function makeDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (let rank = 2; rank <= 14; rank++) {
        deck.push(createCard(suit, rank));
      }
    }
    return deck;
  }

  function shuffle(deck) {
    const copy = cloneCards(deck);
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function cardEquals(a, b) {
    return a && b && a.suit === b.suit && a.rank === b.rank;
  }

  function removeCard(cards, cardToRemove) {
    const index = cards.findIndex((c) => cardEquals(c, cardToRemove));
    if (index === -1) {
      throw new Error(`Kortet finnes ikke i hånden: ${cardToString(cardToRemove)}`);
    }
    const copy = cloneCards(cards);
    copy.splice(index, 1);
    return copy;
  }

  function drawCards(deck, count) {
    if (count < 0) {
      throw new Error("count kan ikke være negativ");
    }
    if (deck.length < count) {
      throw new Error(`Ikke nok kort i stokken. Trenger ${count}, har ${deck.length}`);
    }

    const drawn = deck.slice(0, count).map(cloneCard);
    const remaining = deck.slice(count).map(cloneCard);

    return {
      drawn,
      remaining,
    };
  }

  function dealHands(deck, playerCount, cardsPerPlayer) {
    if (!Number.isInteger(playerCount) || playerCount < 2) {
      throw new Error("playerCount må være minst 2");
    }
    if (!Number.isInteger(cardsPerPlayer) || cardsPerPlayer < 1) {
      throw new Error("cardsPerPlayer må være minst 1");
    }

    const totalNeeded = playerCount * cardsPerPlayer;
    if (deck.length < totalNeeded) {
      throw new Error(
        `Ikke nok kort i stokken til ${playerCount} spillere × ${cardsPerPlayer} kort`
      );
    }

    const workingDeck = cloneCards(deck);
    const hands = Array.from({ length: playerCount }, () => []);

    for (let round = 0; round < cardsPerPlayer; round++) {
      for (let player = 0; player < playerCount; player++) {
        hands[player].push(workingDeck.shift());
      }
    }

    return {
      hands,
      remainingDeck: workingDeck,
    };
  }

  function sortHand(hand, trumpSuit = null) {
    const copy = cloneCards(hand);

    return copy.sort((a, b) => {
      const aTrump = trumpSuit && a.suit === trumpSuit ? 1 : 0;
      const bTrump = trumpSuit && b.suit === trumpSuit ? 1 : 0;

      if (aTrump !== bTrump) {
        return bTrump - aTrump;
      }

      const suitOrder = { S: 0, H: 1, D: 2, C: 3 };
      if (a.suit !== b.suit) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }

      return b.rank - a.rank;
    });
  }

  function getLeadSuit(trick) {
    if (!Array.isArray(trick) || trick.length === 0) {
      return null;
    }
    return trick[0].card.suit;
  }

  function handHasSuit(hand, suit) {
    return hand.some((card) => card.suit === suit);
  }

  function getValidCards(hand, leadSuit) {
    if (!leadSuit) {
      return cloneCards(hand);
    }

    const sameSuit = hand.filter((card) => card.suit === leadSuit);
    if (sameSuit.length > 0) {
      return cloneCards(sameSuit);
    }

    return cloneCards(hand);
  }

  function isValidPlay(hand, card, leadSuit) {
    const validCards = getValidCards(hand, leadSuit);
    return validCards.some((c) => cardEquals(c, card));
  }

  function compareCards(a, b, leadSuit, trumpSuit) {
    const aTrump = trumpSuit && a.suit === trumpSuit;
    const bTrump = trumpSuit && b.suit === trumpSuit;

    if (aTrump && !bTrump) return 1;
    if (!aTrump && bTrump) return -1;

    if (aTrump && bTrump) {
      return a.rank === b.rank ? 0 : a.rank > b.rank ? 1 : -1;
    }

    const aLead = a.suit === leadSuit;
    const bLead = b.suit === leadSuit;

    if (aLead && !bLead) return 1;
    if (!aLead && bLead) return -1;

    if (aLead && bLead) {
      return a.rank === b.rank ? 0 : a.rank > b.rank ? 1 : -1;
    }

    return 0;
  }

  function determineTrickWinner(trick, trumpSuit) {
    if (!Array.isArray(trick) || trick.length === 0) {
      throw new Error("Trick må inneholde minst ett spilt kort");
    }

    const leadSuit = getLeadSuit(trick);
    let winningIndex = 0;

    for (let i = 1; i < trick.length; i++) {
      const challenger = trick[i].card;
      const currentWinner = trick[winningIndex].card;

      if (compareCards(challenger, currentWinner, leadSuit, trumpSuit) > 0) {
        winningIndex = i;
      }
    }

    return {
      winnerPlayerIndex: trick[winningIndex].playerIndex,
      winningPlayIndex: winningIndex,
      winningCard: cloneCard(trick[winningIndex].card),
      leadSuit,
    };
  }

  function playCardFromHand(hand, card, leadSuit) {
    if (!isValidPlay(hand, card, leadSuit)) {
      throw new Error(`Ugyldig spill: ${cardToString(card)}`);
    }

    return removeCard(hand, card);
  }

  function cardLabel(rank) {
    return RANK_LABELS[rank] || String(rank);
  }

  function cardToString(card) {
    return `${SUIT_SYMBOLS[card.suit]}${cardLabel(card.rank)}`;
  }

  function cardToText(card) {
    return `${cardLabel(card.rank)} ${SUIT_NAMES[card.suit]}`;
  }

  function getCardColor(card) {
    return SUIT_COLORS[card.suit];
  }

  function cardsToString(cards) {
    return cards.map(cardToString).join(" ");
  }

  function randomScenario({
    playerCount = 4,
    cardsPerPlayer = 5,
    includeTrump = true,
  } = {}) {
    const deck = shuffle(makeDeck());
    const { hands, remainingDeck } = dealHands(deck, playerCount, cardsPerPlayer);

    let trumpSuit = null;
    let trumpCard = null;

    if (includeTrump) {
      if (remainingDeck.length === 0) {
        throw new Error("Ingen kort igjen til å bestemme trumf");
      }
      trumpCard = cloneCard(remainingDeck[0]);
      trumpSuit = trumpCard.suit;
    }

    return {
      hands,
      remainingDeck,
      trumpSuit,
      trumpCard,
    };
  }

  function nextPlayerIndex(currentPlayerIndex, playerCount) {
    return (currentPlayerIndex + 1) % playerCount;
  }

  function getTrickOrder(startPlayerIndex, playerCount) {
    const order = [];
    let current = startPlayerIndex;

    for (let i = 0; i < playerCount; i++) {
      order.push(current);
      current = nextPlayerIndex(current, playerCount);
    }

    return order;
  }

  function serializeCard(card) {
    return `${card.suit}${card.rank}`;
  }

  function deserializeCard(value) {
    if (typeof value !== "string" || value.length < 2) {
      throw new Error(`Ugyldig kortstreng: ${value}`);
    }

    const suit = value[0];
    const rank = Number(value.slice(1));

    return createCard(suit, rank);
  }

  function remainingCardsExcluding(excludedCards) {
    const excluded = new Set(excludedCards.map(serializeCard));
    return makeDeck().filter((card) => !excluded.has(serializeCard(card)));
  }

  window.BondeEngine = {
    SUITS,
    SUIT_SYMBOLS,
    SUIT_NAMES,
    SUIT_COLORS,
    RANK_LABELS,

    createCard,
    cloneCard,
    cloneCards,

    makeDeck,
    shuffle,
    drawCards,
    dealHands,
    randomScenario,

    sortHand,
    handHasSuit,
    getValidCards,
    isValidPlay,
    playCardFromHand,

    getLeadSuit,
    compareCards,
    determineTrickWinner,

    nextPlayerIndex,
    getTrickOrder,

    cardEquals,
    removeCard,
    remainingCardsExcluding,

    cardLabel,
    cardToString,
    cardToText,
    cardsToString,
    getCardColor,

    serializeCard,
    deserializeCard,
  };
})();
