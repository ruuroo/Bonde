document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startGameBtn");
  startBtn.addEventListener("click", startGame);
});

let gameState = {
    numPlayers: 4,
    difficulty: "medium",
    cardsPerPlayer: 10,
    playerHand: [],
    currentDealer: 0,
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
    const dealerName = gameState.currentDealer === 0 ? "Du" : "Spiller " + (gameState.currentDealer + 1);
    document.getElementById("dealer-info").textContent = "Dealer: " + dealerName;
}

function showBidButtons() {
    const container = document.getElementById("bid-buttons");
    container.innerHTML = "";
    for (let i = 0; i <= gameState.cardsPerPlayer; i++) {
        const btn = document.createElement("button");
        btn.className = "bid-button";
        btn.textContent = i;
        btn.onclick = () => alert(`Du meldte ${i} stikk!`);
        container.appendChild(btn);
    }
}

function startGame() {
    const players = document.getElementById("numPlayers").value;
    const difficulty = document.getElementById("difficulty").value;
    const cards = document.getElementById("numCards").value;

    gameState.numPlayers = parseInt(players);
    gameState.difficulty = difficulty;
    gameState.cardsPerPlayer = parseInt(cards);

    document.getElementById("setup").style.display = "none";
    document.getElementById("game").style.display = "block";

    dealHands();
    showDealer();
    showHand();
    showBidButtons();
}
