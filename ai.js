// ai.js

(function () {
  "use strict";

  const {
    SUITS,
    cloneCards,
  } = window.BondeEngine;

  function countBySuit(hand) {
    const counts = { S: 0, H: 0, D: 0, C: 0 };
    for (const card of hand) {
      counts[card.suit] += 1;
    }
    return counts;
  }

  function getSuitCards(hand, suit) {
    return hand.filter((card) => card.suit === suit);
  }

  function getSideSuits(trumpSuit) {
    return SUITS.filter((s) => s !== trumpSuit);
  }

  function rankPoints(rank, isTrump) {
    if (isTrump) {
      if (rank === 14) return 2.4;
      if (rank === 13) return 1.9;
      if (rank === 12) return 1.5;
      if (rank === 11) return 1.2;
      if (rank === 10) return 0.9;
      if (rank === 9) return 0.65;
      if (rank === 8) return 0.45;
      return 0.2;
    }

    if (rank === 14) return 1.35;
    if (rank === 13) return 0.8;
    if (rank === 12) return 0.45;
    if (rank === 11) return 0.25;
    if (rank === 10) return 0.15;
    return 0.05;
  }

  function evaluateTrumpValue(hand, trumpSuit) {
    const trumpCards = getSuitCards(hand, trumpSuit).sort((a, b) => b.rank - a.rank);
    let value = 0;

    trumpCards.forEach((card, index) => {
      value += rankPoints(card.rank, true);

      if (index === 0 && card.rank >= 12) value += 0.35;
      if (index === 1 && card.rank >= 10) value += 0.2;
    });

    if (trumpCards.length >= 3) value += 0.4;
    if (trumpCards.length >= 4) value += 0.5;
    if (trumpCards.length >= 5) value += 0.6;

    return {
      count: trumpCards.length,
      value,
      cards: trumpCards,
    };
  }

  function evaluateSideSuitValue(hand, suit) {
    const cards = getSuitCards(hand, suit).sort((a, b) => b.rank - a.rank);
    const len = cards.length;
    let value = 0;

    for (const card of cards) {
      value += rankPoints(card.rank, false);
    }

    if (len >= 2 && cards[0] && cards[0].rank === 14) {
      value += 0.25;
    }

    if (len >= 3 && cards[0] && cards[0].rank >= 13) {
      value += 0.2;
    }

    if (len === 1 && cards[0] && cards[0].rank <= 10) {
      value -= 0.15;
    }

    return {
      suit,
      length: len,
      value,
      cards,
    };
  }

  function evaluateVoidPotential(hand, trumpSuit) {
    const counts = countBySuit(hand);
    const sideSuits = getSideSuits(trumpSuit);

    let bonus = 0;

    for (const suit of sideSuits) {
      if (counts[suit] === 0) {
        bonus += 0.5;
      } else if (counts[suit] === 1) {
        bonus += 0.22;
      }
    }

    return bonus;
  }

  function evaluateDistributionValue(hand, trumpSuit) {
    const counts = countBySuit(hand);
    const sideSuits = getSideSuits(trumpSuit);
    const lengths = sideSuits.map((s) => counts[s]).sort((a, b) => a - b);

    let bonus = 0;

    if (lengths[0] === 0) bonus += 0.25;
    if (lengths[0] <= 1) bonus += 0.15;
    if (lengths[lengths.length - 1] >= 3) bonus += 0.12;
    if (lengths[lengths.length - 1] >= 4) bonus += 0.18;

    return bonus;
  }

  function evaluateLosers(hand, trumpSuit) {
    let losers = 0;

    for (const card of hand) {
      const isTrump = card.suit === trumpSuit;

      if (isTrump) {
        if (card.rank <= 6) losers += 0.22;
        else if (card.rank <= 9) losers += 0.1;
      } else {
        if (card.rank <= 9) losers += 0.18;
        else if (card.rank <= 11) losers += 0.08;
      }
    }

    return losers;
  }

  function computeRawStrength(hand, trumpSuit, playerCount) {
    const trump = evaluateTrumpValue(hand, trumpSuit);
    const sideSuitValues = getSideSuits(trumpSuit).map((suit) =>
      evaluateSideSuitValue(hand, suit)
    );

    const sideValue = sideSuitValues.reduce((sum, item) => sum + item.value, 0);
    const voidPotential = evaluateVoidPotential(hand, trumpSuit);
    const distributionBonus = evaluateDistributionValue(hand, trumpSuit);
    const losersPenalty = evaluateLosers(hand, trumpSuit);

    let raw =
      trump.value +
      sideValue +
      voidPotential +
      distributionBonus -
      losersPenalty;

    if (playerCount === 2) raw *= 1.08;
    if (playerCount >= 5) raw *= 0.94;
    if (playerCount >= 6) raw *= 0.9;

    return {
      raw,
      trump,
      sideSuitValues,
      voidPotential,
      distributionBonus,
      losersPenalty,
    };
  }

  function estimateExpectedTricks(rawStrength, cardsPerPlayer, playerCount) {
    let expected = rawStrength / 2.05;

    if (playerCount === 2) expected *= 1.08;
    if (playerCount === 3) expected *= 1.03;
    if (playerCount >= 5) expected *= 0.95;

    expected = Math.max(0, expected);
    expected = Math.min(cardsPerPlayer, expected);

    return expected;
  }

  function buildDistribution(expectedTricks, cardsPerPlayer, rawStrength) {
    const distribution = Array(cardsPerPlayer + 1).fill(0);

    let sigma = 0.85;

    if (rawStrength >= 6) sigma = 0.72;
    else if (rawStrength >= 4) sigma = 0.8;
    else if (rawStrength <= 1.5) sigma = 0.95;

    let total = 0;

    for (let k = 0; k <= cardsPerPlayer; k++) {
      const z = (k - expectedTricks) / sigma;
      const weight = Math.exp(-0.5 * z * z);
      distribution[k] = weight;
      total += weight;
    }

    if (total > 0) {
      for (let i = 0; i < distribution.length; i++) {
        distribution[i] /= total;
      }
    }

    return distribution;
  }

  function expectedScoreForBid(bid, distribution) {
    let expectedScore = 0;

    for (let tricks = 0; tricks < distribution.length; tricks++) {
      const p = distribution[tricks];

      if (tricks === bid) {
        if (bid === 0) {
          expectedScore += p * 5;
        } else {
          expectedScore += p * (10 + bid);
        }
      } else {
        const miss = Math.abs(tricks - bid);
        expectedScore -= p * miss;
      }
    }

    return expectedScore;
  }

  function recommendBidFromDistribution(distribution, cardsPerPlayer) {
    let bestBid = 0;
    let bestScore = -Infinity;

    for (let bid = 0; bid <= cardsPerPlayer; bid++) {
      const score = expectedScoreForBid(bid, distribution);
      if (score > bestScore) {
        bestScore = score;
        bestBid = bid;
      }
    }

    return {
      recommendedBid: bestBid,
      expectedScore: bestScore,
    };
  }

  function describeStrength(rawStrength, expectedTricks, cardsPerPlayer) {
    const ratio = cardsPerPlayer > 0 ? expectedTricks / cardsPerPlayer : 0;

    if (rawStrength >= 7 || ratio >= 0.68) return "Svært sterk";
    if (rawStrength >= 5 || ratio >= 0.52) return "Sterk";
    if (rawStrength >= 3 || ratio >= 0.34) return "Middels";
    if (rawStrength >= 1.7 || ratio >= 0.18) return "Svak";
    return "Svært svak";
  }

  function buildComment(parts) {
    const {
      trump,
      sideSuitValues,
      voidPotential,
      distributionBonus,
      losersPenalty,
      expectedTricks,
      recommendedBid,
    } = parts;

    const comments = [];

    if (trump.count >= 4) {
      comments.push("Du har mye trumf, som trekker hånda tydelig opp.");
    } else if (trump.count === 3) {
      comments.push("Du har grei trumfdekning.");
    } else if (trump.count <= 1) {
      comments.push("Lite trumf gjør hånda mer sårbar.");
    }

    const strongSide = sideSuitValues
      .slice()
      .sort((a, b) => b.value - a.value)[0];

    if (strongSide && strongSide.cards.length > 0 && strongSide.cards[0].rank >= 13) {
      comments.push(`Du har god sidefarge i ${suitText(strongSide.suit)}.`);
    }

    if (voidPotential >= 0.5) {
      comments.push("Kort fordeling i sidefargene kan gi gode stjelingsmuligheter.");
    } else if (distributionBonus >= 0.25) {
      comments.push("Fordelingen i hånda er ganske spillbar.");
    }

    if (losersPenalty >= 1.2) {
      comments.push("Mange lave kort trekker verdien litt ned.");
    }

    comments.push(
      `Modellen anslår omtrent ${expectedTricks.toFixed(1)} stikk og anbefaler bud ${recommendedBid}.`
    );

    return comments.join(" ");
  }

  function suitText(suit) {
    if (suit === "S") return "spar";
    if (suit === "H") return "hjerter";
    if (suit === "D") return "ruter";
    if (suit === "C") return "kløver";
    return suit;
  }

  function analyzeHand({
    hand,
    trumpSuit,
    playerCount,
    cardsPerPlayer,
  }) {
    const safeHand = cloneCards(hand);

    const details = computeRawStrength(safeHand, trumpSuit, playerCount);
    const expectedTricks = estimateExpectedTricks(
      details.raw,
      cardsPerPlayer,
      playerCount
    );

    const distribution = buildDistribution(
      expectedTricks,
      cardsPerPlayer,
      details.raw
    );

    const bidResult = recommendBidFromDistribution(
      distribution,
      cardsPerPlayer
    );

    const handStrength = describeStrength(
      details.raw,
      expectedTricks,
      cardsPerPlayer
    );

    const comment = buildComment({
      trump: details.trump,
      sideSuitValues: details.sideSuitValues,
      voidPotential: details.voidPotential,
      distributionBonus: details.distributionBonus,
      losersPenalty: details.losersPenalty,
      expectedTricks,
      recommendedBid: bidResult.recommendedBid,
    });

    return {
      expectedTricks,
      recommendedBid: bidResult.recommendedBid,
      handStrength,
      distribution,
      comment,
      details: {
        rawStrength: details.raw,
        trumpCount: details.trump.count,
        voidPotential: details.voidPotential,
        distributionBonus: details.distributionBonus,
        losersPenalty: details.losersPenalty,
      },
    };
  }

  window.BondeAI = {
    analyzeHand,
    countBySuit,
    computeRawStrength,
    estimateExpectedTricks,
    buildDistribution,
    recommendBidFromDistribution,
  };
})();
