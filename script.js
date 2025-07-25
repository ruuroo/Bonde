document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("startGameBtn").addEventListener("click", startGame);
});

const suits = ["♠", "♣", "♥", "♦"];
const values = ["7", "8", "9", "10", "J", "Q", "K", "A"];

let gameState = {
  numPlayers: 4,
  difficulty: "medium",
  cardsPerPlayer: 5,
  playerHand: [],
  otherHands: [],
  dealer: 0,
  trump: null,
  round: 0,
  trickLeader: 0,
  playerBid: 0,
  currentTrick: [],
  trickHistory: [],
  playerTricksWon: 0,
  turn: 0,
  phase: "bidding"
};

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

function startGame() {
  gameState.numPlayers = parseInt(document.getElementById("numPlayers").value);
  gameState.difficulty = document.getElementById("difficulty").value;
  gameState.cardsPerPlayer = parseInt(document.getElementById("numCards").value);
  gameState.dealer = Math.floor(Math.random() * gameState.numPlayers);
  gameState.turn = (gameState.dealer + 1) % gameState.numPlayers;
  gameState.trickLeader = gameState.turn;
  gameState.round = 0;
  gameState.playerTricksWon = 0;
  gameState.trickHistory = [];

  const deck = generateDeck();
  shuffle(deck);

  gameState.playerHand = deck.slice(0, gameState.cardsPerPlayer);
  gameState.otherHands = [];
  for (let i = 1; i < gameState.numPlayers; i++) {
    const start = i * gameState.cardsPerPlayer;
    const end = start + gameState.cardsPerPlayer;
    gameState.otherHands.push(deck.slice(start, end));
  }

  gameState.trump = deck[deck.length - 1].slice(-1);

  document.getElementById("setup").style.display = "none";
  document.getElementById("game").style.display = "block";
  showStatus();
  showHand();
  showBidButtons();
}

function showStatus() {
  const dealerName = gameState.dealer === 0 ? "Du" : "Spiller " + (gameState.dealer + 1);
  const trumpSymbol = gameState.trump;
  let status = `Dealer: ${dealerName}<br>Trumf: ${trumpSymbol}`;
  if (gameState.phase === "bidding" && gameState.playerBid > 0) {
    status += `<br>Du meldte ${gameState.playerBid} stikk.`;
  }
  document.getElementById("status").innerHTML = status;
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

function getSuitClass(card) {
  const suit = card.slice(-1);
  return suit === "♥" || suit === "♦" ? "red" : "black";
}

function showBidButtons() {
  const container = document.getElementById("bid-buttons");
  container.innerHTML = "";
  for (let i = 0; i <= gameState.cardsPerPlayer; i++) {
    const btn = document.createElement("button");
    btn.className = "bid-button";
    btn.textContent = i;
    btn.onclick = () => {
      gameState.playerBid = i;
      gameState.phase = "playing";
      showStatus();
      container.innerHTML = "";
      startTrick();
    };
    container.appendChild(btn);
  }
}

function startTrick() {
  gameState.currentTrick = [];
  gameState.turn = gameState.trickLeader;
  document.getElementById("trick").innerHTML = "Spilte kort:";
  if (gameState.turn === 0) {
    showHand();
  } else {
    aiPlay();
  }
}

function playCard(index) {
  if (gameState.turn !== 0 || gameState.phase !== "playing") return;

  const playedCard = gameState.playerHand.splice(index, 1)[0];
  gameState.currentTrick.push({ player: 0, card: playedCard });
  updateTrickDisplay();
  nextTurn();
}

function aiPlay() {
  const handIndex = gameState.turn - 1;
  const hand = gameState.otherHands[handIndex];
  const playedCard = hand.pop();
  gameState.currentTrick.push({ player: gameState.turn, card: playedCard });
  updateTrickDisplay();
  nextTurn();
}

function updateTrickDisplay() {
  const div = document.getElementById("trick");
  div.innerHTML = "Spilte kort:<br>";
  gameState.currentTrick.forEach(entry => {
    const name = entry.player === 0 ? "Du" : "Spiller " + (entry.player + 1);
    div.innerHTML += `${name}: ${entry.card} <br>`;
  });
}

function nextTurn() {
  gameState.turn = (gameState.turn + 1) % gameState.numPlayers;
  if (gameState.currentTrick.length < gameState.numPlayers) {
    if (gameState.turn === 0) {
      showHand();
    } else {
      setTimeout(aiPlay, 500);
    }
  } else {
    endTrick();
  }
}

function endTrick() {
  const winner = determineTrickWinner(gameState.currentTrick);
  if (winner === 0) {
    gameState.playerTricksWon++;
  }
  gameState.trickLeader = winner;
  gameState.round++;
  gameState.trickHistory.push(gameState.currentTrick);

  if (gameState.round >= gameState.cardsPerPlayer) {
    endRound();
  } else {
    setTimeout(startTrick, 1000);
  }
}

function determineTrickWinner(trick) {
  const leadSuit = trick[0].card.slice(-1);
  let bestCard = trick[0];
  for (let entry of trick.slice(1)) {
    const suit = entry.card.slice(-1);
    const value = entry.card.slice(0, -1);
    const bestValue = bestCard.card.slice(0, -1);
    if (
      (suit === gameState.trump && bestCard.card.slice(-1) !== gameState.trump) ||
      (suit === bestCard.card.slice(-1) &&
        values.indexOf(value) > values.indexOf(bestValue))
    ) {
      bestCard = entry;
    }
  }
  return bestCard.player;
}

function endRound() {
  const feedback = document.createElement("div");
  feedback.className = "feedback";
  feedback.innerHTML = `Du meldte ${gameState.playerBid} stikk og tok ${gameState.playerTricksWon}.`;
  if (gameState.playerBid !== gameState.playerTricksWon) {
    feedback.innerHTML += ` (Tips: Du burde vurdert ${gameState.playerTricksWon})`;
  }
  document.getElementById("game").appendChild(feedback);
}
