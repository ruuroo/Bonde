// analysis.js

const rankOrder = { "7": 0, "8": 1, "9": 2, "10": 3, "J": 4, "Q": 5, "K": 6, "A": 7 };

export function analyzePlay(trick, trumpSuit, leadSuit) {
  if (!trick || trick.length === 0) return "Ingen kort spilt ennå.";

  const highestCard = getWinningCard(trick, trumpSuit, leadSuit);
  const winner = trick.find(([_, card]) => card === highestCard)[0];

  const tips = [];
  const playerCards = trick.map(([player, card]) => `${card} (${player === 0 ? "Du" : "Spiller " + player})`);
  tips.push(`🔍 Analyse av stikk: ${playerCards.join(" | ")}`);
  tips.push(`🏆 Beste kort: ${highestCard}`);

  if (trick[0][0] === 0) {
    tips.push("💡 Du startet stikket – husk å bruke sterke kort taktisk.");
  } else if (winner === 0) {
    tips.push("✅ Du vant stikket! Bra spilt.");
  } else {
    tips.push("❌ Du tapte stikket – vurder om et annet kort kunne gitt bedre resultat.");
  }

  return tips.join("\n");
}

function getWinningCard(trick, trumpSuit, leadSuit) {
  let bestValue = -1;
  let bestCard = null;

  for (let [_, card] of trick) {
    const suit = card.slice(-1);
    const value = rankOrder[card.slice(0, -1)];
    let score = value;

    if (suit === trumpSuit) score += 100;
    else if (suit === leadSuit) score += 50;

    if (score > bestValue) {
      bestValue = score;
      bestCard = card;
    }
  }

  return bestCard;
}
