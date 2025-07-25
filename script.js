const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const difficulties = ["lett", "middels", "vanskelig"];

let players = [];
let currentDealer = 0;
let round = 0;
let maxCards = 0;
let directionDown = true;

function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return shuffle(deck);
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function sortHand(hand) {
  return hand.sort((a, b) => {
    if (a.suit !== b.suit) {
      return suits.indexOf(a.suit) - suits.indexOf(b.suit);
    }
    return ranks.indexOf(a.rank) - ranks.indexOf(b.rank);
  });
}

function dealCards(deck, numCards) {
  for (const player of players) {
    player.hand = sortHand(deck.splice(0, numCards));
  }
}

function rotateDealer() {
  currentDealer = (currentDealer + 1) % players.length;
}

function getStartingPlayer() {
  const dealerIndex = currentDealer;
  const leftOfDealer = (dealerIndex + 1) % players.length;

  const bids = players.map(p => p.bid);
  const totalBids = bids.reduce((a, b) => a + b, 0);
  const expectedTricks = players[0].hand.length;

  if (totalBids === expectedTricks) {
    return leftOfDealer;
  }
  return dealerIndex;
}

function createPlayers(numPlayers, userIndex = 0, aiDifficulty = "middels") {
  players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push({
      name: i === userIndex ? "Deg" : `Spiller ${i + 1}`,
      hand: [],
      bid: 0,
      tricks: 0,
      difficulty: i === userIndex ? null : aiDifficulty
    });
  }
}

function getSuggestedBid(hand) {
  let highCards = hand.filter(card => ["A", "K", "Q"].includes(card.rank));
  return Math.max(1, Math.floor(highCards.length / 2));
}

function aiBid(player) {
  const hand = player.hand;
  const difficulty = player.difficulty;
  if (difficulty === "lett") return Math.floor(hand.length / 4);
  if (difficulty === "middels") return getSuggestedBid(hand);
  if (difficulty === "vanskelig") {
    return Math.min(hand.length, Math.floor(hand.length / 2) + Math.random() < 0.3 ? 1 : 0);
  }
}

function giveTips(player) {
  const suggestion = getSuggestedBid(player.hand);
  let text = `Du meldte ${player.bid} stikk.`;
  text += ` Basert på hånden burde du kanskje meldt ${suggestion}.`;

  const suitCount = {};
  player.hand.forEach(card => {
    suitCount[card.suit] = (suitCount[card.suit] || 0) + 1;
  });

  const strongestSuit = Object.entries(suitCount).sort((a, b) => b[1] - a[1])[0][0];
  text += ` Prøv å kontrollere ${strongestSuit}-fargen og hold igjen høye kort til du er sist ut.`;
  return text;
}

// MAIN GAME LOOP (simplified for demo)
function playRound() {
  const deck = createDeck();
  const cardsPerPlayer = maxCards - Math.abs(round);
  dealCards(deck, cardsPerPlayer);

  for (const player of players) {
    if (player.name === "Deg") {
      player.bid = prompt(`Du har ${cardsPerPlayer} kort. Hvor mange stikk melder du?`);
    } else {
      player.bid = aiBid(player);
    }
  }

  const starter = getStartingPlayer();
  alert(`Spiller som starter: ${players[starter].name}`);

  // Placeholder: simulate round
  for (const player of players) {
    player.tricks = Math.floor(Math.random() * (cardsPerPlayer + 1));
  }

  // Result and tips
  for (const player of players) {
    let msg = `${player.name}: Meldte ${player.bid}, tok ${player.tricks}.`;
    if (player.name === "Deg") {
      msg += `\n\nTips: ${giveTips(player)}`;
    }
    alert(msg);
  }

  // Prepare for next round
  if (directionDown) {
    round--;
    if (round <= -(maxCards - 1)) directionDown = false;
  } else {
    round++;
  }
  rotateDealer();
}

// INITIAL SETUP (example)
function setupGame() {
  const numPlayers = parseInt(prompt("Hvor mange spillere? (2-6)"));
  const cards = parseInt(prompt("Hvor mange kort per spiller på det meste? (max 10 ved 5 spillere, 8 ved 6)"));
  const difficulty = prompt("Vanskelighetsgrad for AI (lett/middels/vanskelig)?");

  createPlayers(numPlayers, 0, difficulty);
  round = 0;
  maxCards = cards;
  directionDown = true;

  playRound();
}
