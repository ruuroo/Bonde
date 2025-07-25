document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startGameBtn");
  startBtn.addEventListener("click", startGame);
});

let gameState = {
  numPlayers: 4,
  difficulty: "medium",
  cardsPerPlayer: 10,
  playerHand: [],
  trumpSuit: "",
  currentDealer: 0,
  bids: [],
  round: 0,
  tableCards: [],
  playerNames: ["Du", "Spiller 2", "Spiller 3", "Spiller 4"],
  playedCards: [],
  currentPlayer: 0,
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

function dealHands() {
  const deck = generateDeck();
  shuffle(deck);
  gameState.playerHand = deck.slice(0, gameState.cardsPerPlayer);
  gameState.trumpSuit = deck[deck.length - 1].slice(-1);
  gameState.playedCards = [];
  gameState.bids = new Array(gameState.numPlayers).fill(null);
}

function getSuitClass(card) {
  const suit = card.slice(-1);
  return suit === "♥" || suit === "♦" ? "red" : "black";
}

function showHand() {
  const container = document.getElementById("hand-container");
  container.innerHTML = "";
  gameState.playerHand.forEach((card, index) => {
    const div = document.createElement("div");
    div.className = "card " + getSuitClass(card);
    div.textContent = card;
    div.onclick = () => playCard(index);
    container.appendChild(div);
  });
}

function showDealer() {
  const dealerName = gameState.playerNames[gameState.currentDealer];
  document.getElementById("dealer-info").textContent = "Dealer: " + dealerName;
}

function showTrump() {
  document.getElementById("trump-info").textContent = "Trumf: " + gameState.trumpSuit;
}

function showBidButtons() {
  const container = document.getElementById("bid-buttons");
  container.innerHTML = "<p>Meld stikk:</p>";
  for (let i = 0; i <= gameState.cardsPerPlayer; i++) {
    const btn = document.createElement("button");
    btn.className = "bid-button";
    btn.textContent = i;
    btn.onclick = () => handleBid(i);
    container.appendChild(btn);
  }
}

function handleBid(bid) {
  gameState.bids[0] = bid;
  document.getElementById("bid-buttons").innerHTML = "<p>Du meldte: " + bid + " stikk</p>";
  setTimeout(() => {
    showHand();
    showTable();
  }, 1000);
}

function showTable() {
  const table = document.getElementById("table");
  table.innerHTML = "";
  gameState.playedCards.forEach((play, index) => {
    const div = document.createElement("div");
    div.className = "card " + getSuitClass(play);
    div.textContent = play;
    table.appendChild(div);
  });
}

function playCard(index) {
  const card = gameState.playerHand.splice(index, 1)[0];
  gameState.playedCards.push(card);
  showHand();
  showTable();
}

function startGame() {
  gameState.numPlayers = parseInt(document.getElementById("numPlayers").value);
  gameState.difficulty = document.getElementById("difficulty").value;
  gameState.cardsPerPlayer = parseInt(document.getElementById("numCards").value);

  document.getElementById("setup").style.display = "none";
  document.getElementById("game").style.display = "block";

  dealHands();
  showDealer();
  showTrump();
  showHand();
  showBidButtons();
}
