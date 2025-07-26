// script.js
import { analyzePlay } from "./analysis.js";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("startGameBtn").addEventListener("click", startGame);
});

const suits = ["♠", "♥", "♦", "♣"];
const values = ["7", "8", "9", "10", "J", "Q", "K", "A"];
const rankOrder = { "7": 0, "8": 1, "9": 2, "10": 3, "J": 4, "Q": 5, "K": 6, "A": 7 };

let gameState = {
  numPlayers: 2,
  cardsPerPlayer: 5,
  difficulty: "medium",
  trump: null,
  hands: [],
  bids: [],
  tricksWon: [],
  playerNames: [],
  playedCards: [],
  currentTrick: [],
  currentPlayer: 0,
  dealer: 0,
  leadSuit: null,
  round: 1,
};

function startGame() {
  gameState.numPlayers = parseInt(document.getElementById("numPlayers").value);
  gameState.cardsPerPlayer = parseInt(document.getElementById("startCards").value);
  gameState.difficulty = document.getElementById("difficulty").value;
  gameState.trump = suits[Math.floor(Math.random() * 4)];
  gameState.hands = dealHands(gameState.numPlayers, gameState.cardsPerPlayer);
  gameState.bids = new Array(gameState.numPlayers).fill(null);
  gameState.tricksWon = new Array(gameState.numPlayers).fill(0);
  gameState.playedCards = [];
  gameState.playerNames = Array.from({ length: gameState.numPlayers }, (_, i) => (i === 0 ? "Du" : "Spiller " + i));
  gameState.currentTrick = [];
  gameState.currentPlayer = (gameState.dealer + 1) % gameState.numPlayers;
  gameState.leadSuit = null;

  document.getElementById("startMenu").style.display = "none";
  document.getElementById("gameArea").style.display = "block";

  showTrump();
  showDealer();
  showBidding();
}

function dealHands(numPlayers, numCards) {
  let deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push(value + suit);
    }
  }
  shuffle(deck);
  let hands = [];
  for (let i = 0; i < numPlayers; i++) {
    hands.push(deck.splice(0, numCards).sort(compareCards));
  }
  return hands;
}

function compareCards(a, b) {
  const [vA, sA] = [a.slice(0, -1), a.slice(-1)];
  const [vB, sB] = [b.slice(0, -1), b.slice(-1)];
  if (sA !== sB) return suits.indexOf(sA) - suits.indexOf(sB);
  return rankOrder[vA] - rankOrder[vB];
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function showTrump() {
  document.getElementById("playInfo").textContent = `Trumf: ${gameState.trump}`;
}

function showDealer() {
  const dealer = gameState.dealer;
  document.getElementById("dealerInfo").textContent = `Dealer: ${gameState.playerNames[dealer]}`;
}

function showBidding() {
  const container = document.getElementById("bidSection");
  container.innerHTML = "<p>Meld hvor mange stikk du tror du får:</p>";
  for (let i = 0; i <= gameState.cardsPerPlayer; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.onclick = () => {
      gameState.bids[0] = i;
      startTrick();
    };
    container.appendChild(btn);
  }
}

function startTrick() {
  document.getElementById("bidSection").innerHTML = "";
  showHand();
  showPlayedCards();
  if (gameState.currentPlayer === 0) {
    promptPlayerMove();
  } else {
    setTimeout(() => {
      aiPlayCard(gameState.currentPlayer);
    }, 800);
  }
}

function showHand() {
  const container = document.getElementById("handContainer");
  container.innerHTML = "";
  gameState.hands[0].forEach((card, index) => {
    const div = document.createElement("button");
    div.className = "card " + (["♥", "♦"].includes(card.slice(-1)) ? "red" : "black");
    div.textContent = card;
    div.onclick = () => playerPlaysCard(index);
    container.appendChild(div);
  });
}

function promptPlayerMove() {
  document.getElementById("playInfo").textContent = "Din tur – velg et kort å spille.";
}

function playerPlaysCard(index) {
  const card = gameState.hands[0][index];
  if (gameState.leadSuit && card.slice(-1) !== gameState.leadSuit) {
    const hasLead = gameState.hands[0].some(c => c.slice(-1) === gameState.leadSuit);
    if (hasLead) return; // Må følge farge
  }

  gameState.hands[0].splice(index, 1);
  gameState.currentTrick.push([0, card]);
  gameState.playedCards.push({ player: 0, card });
  if (!gameState.leadSuit) gameState.leadSuit = card.slice(-1);
  nextPlayer();
}

function aiPlayCard(playerIndex) {
  const hand = gameState.hands[playerIndex];
  const valid = gameState.leadSuit ? hand.filter(c => c.slice(-1) === gameState.leadSuit) : hand;
  const play = valid.length > 0 ? valid[0] : hand[0];
  hand.splice(hand.indexOf(play), 1);
  gameState.currentTrick.push([playerIndex, play]);
  gameState.playedCards.push({ player: playerIndex, card: play });
  if (!gameState.leadSuit) gameState.leadSuit = play.slice(-1);
  nextPlayer();
}

function nextPlayer() {
  gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.numPlayers;
  if (gameState.currentTrick.length === gameState.numPlayers) {
    finishTrick();
  } else if (gameState.currentPlayer === 0) {
    showHand();
    promptPlayerMove();
  } else {
    setTimeout(() => aiPlayCard(gameState.currentPlayer), 800);
  }
}

function finishTrick() {
  const winner = determineTrickWinner();
  gameState.tricksWon[winner]++;
  gameState.currentPlayer = winner;
  gameState.leadSuit = null;

  const feedback = analyzePlay(gameState.currentTrick, gameState.trump, gameState.leadSuit);
  document.getElementById("playInfo").textContent = feedback;

  gameState.currentTrick = [];
  showPlayedCards();

  if (gameState.hands[0].length === 0) {
    showResult();
  } else {
    setTimeout(startTrick, 2000);
  }
}

function determineTrickWinner() {
  let bestValue = -1;
  let winner = null;
  for (let [player, card] of gameState.currentTrick) {
    let value = rankOrder[card.slice(0, -1)];
    const suit = card.slice(-1);
    if (suit === gameState.trump) value += 100;
    else if (suit === gameState.leadSuit) value += 50;
    if (value > bestValue) {
      bestValue = value;
      winner = player;
    }
  }
  return winner;
}

function showPlayedCards() {
  const div = document.getElementById("playedCards");
  div.innerHTML = "<h4>Spilte kort</h4>";
  gameState.currentTrick.forEach(([player, card]) => {
    const p = document.createElement("p");
    p.textContent = `${gameState.playerNames[player]}: ${card}`;
    div.appendChild(p);
  });
}
