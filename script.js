document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startGameBtn");
  startBtn.addEventListener("click", startGame);
});

let gameState = {
  numPlayers: 4,
  difficulty: "medium",
  cardsPerPlayer: 5,
  playerHand: [],
  currentDealer: 0,
  trumpSuit: null,
  bid: null,
  playedCard: null
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
  gameState.trumpSuit = suits[Math.floor(Math.random() * suits.length)];
}

function getSuitClass(card) {
  const suit = card.slice(-1);
  return suit === "♥" || suit === "♦" ? "red" : "black";
}

function showDealer() {
  const dealerName = gameState.currentDealer === 0 ? "Du" : "Spiller " + (gameState.currentDealer + 1);
  document.getElementById("dealerInfo").textContent = "Dealer: " + dealerName;
}

function showTrump() {
  document.getElementById("playInfo").textContent = "Trumf: " + gameState.trumpSuit;
}

function showHand() {
  const container = document.getElementById("handContainer");
  container.innerHTML = "";
  gameState.playerHand.forEach((card, index) => {
    const div = document.createElement("div");
    div.className = "card " + getSuitClass(card);
    div.textContent = card;
    div.onclick = () => playCard(index);
    container.appendChild(div);
  });
}

function showBidButtons() {
  const container = document.getElementById("bidSection");
  container.innerHTML = "<p>Meld stikk:</p>";
  for (let i = 0; i <= gameState.cardsPerPlayer; i++) {
    const btn = document.createElement("button");
    btn.className = "bid-button";
    btn.textContent = i;
    btn.onclick = () => makeBid(i);
    container.appendChild(btn);
  }
}

function makeBid(bidValue) {
  gameState.bid = bidValue;
  document.getElementById("bidSection").innerHTML = `<p>Du meldte ${bidValue} stikk.</p>`;
}

function playCard(index) {
  const card = gameState.playerHand.splice(index, 1)[0];
  gameState.playedCard = card;

  const playedContainer = document.getElementById("playedCards");
  playedContainer.innerHTML = `<p>Du spilte: <span class="${getSuitClass(card)} card">${card}</span></p>`;

  showHand(); // Oppdater hånden etter kortet er spilt
}

function startGame() {
  const players = document.getElementById("numPlayers").value;
  const difficulty = document.getElementById("difficulty").value;
  const cards = document.getElementById("startCards").value;

  gameState.numPlayers = parseInt(players);
  gameState.difficulty = difficulty;
  gameState.cardsPerPlayer = parseInt(cards);

  document.getElementById("startMenu").style.display = "none";
  document.getElementById("gameArea").style.display = "block";

  dealHands();
  showDealer();
  showTrump();
  showHand();
  showBidButtons();
}
