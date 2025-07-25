const suits = ["♠", "♥", "♦", "♣"];
const values = ["7", "8", "9", "10", "J", "Q", "K", "A"];

let players = [
  { name: "Du", hand: [], bid: 0, tricks: 0 },
  { name: "Spiller 2", hand: [], bid: 0, tricks: 0 },
  { name: "Spiller 3", hand: [], bid: 0, tricks: 0 },
];

let round = 1;
let dealerIndex = 0;
let cardsPerPlayer = 5;
let deck = [];

function startGame() {
  nextRound();
}

function nextRound() {
  // Oppdater dealer
  dealerIndex = (dealerIndex + 1) % players.length;
  document.getElementById("dealer-info").textContent =
    "Dealer: " + players[dealerIndex].name;

  // Nullstill
  players.forEach((p) => {
    p.hand = [];
    p.bid = 0;
    p.tricks = 0;
  });
  document.getElementById("result-message").textContent = "";
  document.getElementById("round-result").classList.add("hidden");

  shuffleDeck();
  dealCards();
  showHand();
  document.getElementById("bidding").classList.remove("hidden");
}

function shuffleDeck() {
  deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push(value + suit);
    }
  }
  deck.sort(() => Math.random() - 0.5);
}

function dealCards() {
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (let player of players) {
      player.hand.push(deck.pop());
    }
  }
  players.forEach((p) =>
    p.hand.sort((a, b) =>
      suits.indexOf(a.slice(-1)) !== suits.indexOf(b.slice(-1))
        ? suits.indexOf(a.slice(-1)) - suits.indexOf(b.slice(-1))
        : values.indexOf(a.slice(0, -1)) - values.indexOf(b.slice(0, -1))
    )
  );
}

function showHand() {
  const handDiv = document.getElementById("hand");
  handDiv.innerHTML = "";
  for (let card of players[0].hand) {
    const btn = document.createElement("button");
    btn.textContent = card;
    btn.className = "card-button";
    btn.onclick = () => playCard(card);
    handDiv.appendChild(btn);
  }
}

function submitBid() {
  const bid = parseInt(document.getElementById("bid").value);
  if (isNaN(bid) || bid < 0 || bid > cardsPerPlayer) {
    alert("Ugyldig bud.");
    return;
  }
  players[0].bid = bid;
  // Enkel AI
  for (let i = 1; i < players.length; i++) {
    players[i].bid = Math.floor(Math.random() * (cardsPerPlayer + 1));
  }
  document.getElementById("bidding").classList.add("hidden");
  document.getElementById("status").textContent =
    `Du meldte ${bid}. Andre meldte: ` +
    players
      .slice(1)
      .map((p) => `${p.name}: ${p.bid}`)
      .join(", ");
}

function playCard(card) {
  const idx = players[0].hand.indexOf(card);
  if (idx > -1) {
    players[0].hand.splice(idx, 1);
    document.getElementById("status").textContent =
      "Du spilte: " + card + ". Runde over.";
    document.getElementById("result-message").textContent =
      "Tips: Husk å telle trumf og hvem som er dealer.";
    document.getElementById("round-result").classList.remove("hidden");
    document.getElementById("play").classList.add("hidden");
    document.getElementById("hand").innerHTML = "";
  }
}

// Start første runde automatisk
window.onload = startGame;
