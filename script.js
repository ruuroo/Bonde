document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("startGameBtn").addEventListener("click", startGame);
});

let gameState = {
  numPlayers: 4,
  difficulty: "medium",
  cardsPerPlayer: 5,
  playerHand: [],
  dealer: 0,
  trump: "",
};

const suits = ["♠", "♣", "♥", "♦"];
const values = ["7", "8", "9", "10", "J", "Q", "K", "A"];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function generateDeck() {
  const deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push(value + suit);
    }
  }
  return deck;
}

function assignTrump(deck) {
  const trumpCard = deck.pop();
  gameState.trump = trumpCard.slice(-1);
  document.getElementById("trump-info").textContent = "Trumf: " + trumpCard;
}

function dealHands(deck) {
  const hands = [];
  for (let i = 0; i < gameState.numPlayers; i++) {
    hands.push(deck.splice(0, gameState.cardsPerPlayer));
  }
  gameState.playerHand = hands[0].sort(compareCards);
}

function compareCards(a, b) {
  const suitOrder = { "♠": 1, "♣": 2, "♥": 3, "♦": 4 };
  const valOrder = values;
  const [valA, suitA] = [a.slice(0, -1), a.slice(-1)];
  const [valB, suitB] = [b.slice(0, -1), b.slice(-1)];
  if (suitOrder[suitA] !== suitOrder[suitB]) {
    return suitOrder[suitA] - suitOrder[suitB];
  }
  return valOrder.indexOf(valA) - valOrder.indexOf(valB);
}

function getSuitClass(card) {
  const suit = card.slice(-1);
  return suit === "♥" || suit === "♦" ? "red" : "black";
}

function showHand() {
  const container = document.getElementById("hand-container");
  container.innerHTML = "";
  gameState.playerHand.forEach(card => {
    const div = document.createElement("div");
    div.className = "card " + getSuitClass(card);
    div.textContent = card;
    container.appendChild(div);
  });
}

function showDealer() {
  const name = gameState.dealer === 0 ? "Du" : "Spiller " + (gameState.dealer + 1);
  document.getElementById("dealer-info").textContent = "Dealer: " + name;
}

function showBidButtons() {
  const container = document.getElementById("bid-buttons");
  container.innerHTML = "";
  for (let i = 0; i <= gameState.cardsPerPlayer; i++) {
    const btn = document.createElement("button");
    btn.className = "bid-button";
    btn.textContent = i;
    btn.onclick = () => {
      container.innerHTML = `Du meldte ${i} stikk. (Tips: Du burde vurdert ${suggestBid()})`;
    };
    container.appendChild(btn);
  }
}

function suggestBid() {
  // Enkel heuristikk: vurder høye kort
  const strong = gameState.playerHand.filter(card => {
    const val = card.slice(0, -1);
    return ["A", "K", "Q", "J", "10"].includes(val);
  });
  return Math.max(1, Math.floor(strong.length * 0.8));
}

function startGame() {
  // Hent innstillinger
  gameState.numPlayers = parseInt(document.getElementById("numPlayers").value);
  gameState.cardsPerPlayer = parseInt(document.getElementById("startCards").value);
  gameState.difficulty = document.getElementById("difficulty").value;

  // Skjul meny og vis spill
  document.getElementById("startMenu").style.display = "none";
  document.getElementById("gameArea").style.display = "block";

  // Start ny runde
  const deck = generateDeck();
  shuffle(deck);
  assignTrump(deck);
  dealHands(deck);
  showDealer();
  showHand();
  showBidButtons();
}
