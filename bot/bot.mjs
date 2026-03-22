import { io } from "socket.io-client";

const socket = io("http://localhost:3001", { autoConnect: false });

let myPlayerId = null;
let gameState = null;
let legalActions = [];
let cardDefs = {};
let thinkTimer = null;

socket.on("connect", () => {
  console.log("[bot] Connected, listing games...");
  socket.emit("list_games");
});

socket.on("lobby_update", ({ games }) => {
  if (myPlayerId) return; // already in a game
  if (games.length > 0) {
    const game = games[0];
    console.log(`[bot] Joining game ${game.gameId}...`);
    socket.emit("join_game", { gameId: game.gameId });
  } else {
    console.log("[bot] No open games, waiting...");
  }
});

socket.on("game_started", ({ state, legalActions: la, cardDefinitions }) => {
  cardDefs = cardDefinitions;
  gameState = state;
  legalActions = la;
  // Figure out which player I am — I'm player2 since I joined
  myPlayerId = "player2";
  console.log(`[bot] Game started! I am ${myPlayerId}`);
  printState();
  think();
});

socket.on("game_state", ({ state, legalActions: la, events }) => {
  gameState = state;
  legalActions = la;
  for (const e of events) {
    console.log(`[bot] Event: ${e.type}`, summarizeEvent(e));
  }
  printState();
  think();
});

socket.on("error", ({ message }) => {
  console.log(`[bot] Error: ${message}`);
});

socket.on("opponent_disconnected", () => {
  console.log("[bot] Opponent disconnected!");
});

function summarizeEvent(e) {
  switch (e.type) {
    case "card_played": return `${e.player} played ${cardDefs[e.definitionId]?.name ?? e.definitionId}`;
    case "mythium_gained": return `${e.player} +${e.amount} mythium`;
    case "power_gained": return `${e.player} +${e.amount} power`;
    case "card_drawn": return `${e.player} drew a card`;
    case "combat_started": return `${e.attackingPlayer} attacks!`;
    case "turn_advanced": return `Turn → ${e.activePlayer}`;
    default: return "";
  }
}

function printState() {
  if (!gameState) return;
  const me = gameState.players[myPlayerId];
  const opp = gameState.players[myPlayerId === "player1" ? "player2" : "player1"];
  console.log(`[bot] Round ${gameState.round} | Phase: ${gameState.phase} | Active: ${gameState.activePlayer}`);
  console.log(`[bot] Me: ${me.mythium}M ${me.power}P | Opp: ${opp.mythium}M ${opp.power}P`);
  console.log(`[bot] ${legalActions.length} legal actions available`);
  if (gameState.pendingChoice) {
    console.log(`[bot] Pending: ${gameState.pendingChoice.type} for ${gameState.pendingChoice.playerId}`);
  }
}

function cardName(instanceId) {
  const card = gameState.cards.find(c => !c.hidden && c.instanceId === instanceId);
  if (!card) return instanceId;
  return cardDefs[card.definitionId]?.name ?? card.definitionId;
}

function think() {
  if (thinkTimer) {
    clearTimeout(thinkTimer);
    thinkTimer = null;
  }

  if (!gameState || legalActions.length === 0) return;
  if (gameState.phase === "gameOver") {
    console.log(`[bot] Game over! Winner: ${gameState.winner}`);
    return;
  }

  // Only act on my turn or my pending choice
  const pending = gameState.pendingChoice;
  if (pending && pending.playerId !== myPlayerId) return;
  if (!pending && gameState.activePlayer !== myPlayerId) return;

  thinkTimer = setTimeout(() => {
    thinkTimer = null;
    doAction();
  }, 1500);
}

function doAction() {
  if (legalActions.length === 0) return;

  const pending = gameState.pendingChoice;

  // Handle mulligan — keep hand
  if (pending?.type === "choose_mulligan") {
    console.log("[bot] Keeping hand (no mulligan)");
    submit({ type: "mulligan", cardInstanceIds: [] });
    return;
  }

  // Handle trigger choices — pick first or skip
  if (pending?.type === "choose_trigger_order") {
    const triggerAction = legalActions.find(a => a.type === "choose_trigger");
    const skipAction = legalActions.find(a => a.type === "skip_trigger");
    if (triggerAction) {
      console.log("[bot] Choosing trigger");
      submit(triggerAction);
    } else if (skipAction) {
      submit(skipAction);
    }
    return;
  }

  // Handle mode choices — pick first mode
  if (pending?.type === "choose_mode") {
    const modeAction = legalActions.find(a => a.type === "choose_mode");
    if (modeAction) {
      console.log(`[bot] Choosing mode: ${modeAction.modeIndex}`);
      submit(modeAction);
      return;
    }
  }

  // Handle target choices — pick first valid target
  if (pending?.type === "choose_target") {
    const targetAction = legalActions.find(a => a.type === "choose_target");
    if (targetAction) {
      console.log(`[bot] Targeting: ${cardName(targetAction.targetInstanceId)}`);
      submit(targetAction);
      return;
    }
  }

  // Handle discard — discard first cards
  if (pending?.type === "choose_discard") {
    const discardAction = legalActions.find(a => a.type === "choose_discard");
    if (discardAction) {
      submit(discardAction);
      return;
    }
  }

  // Handle blocker selection — skip blocking
  if (pending?.type === "choose_blockers") {
    const skipAction = legalActions.find(a => a.type === "skip_blockers");
    const blockAction = legalActions.find(a => a.type === "declare_blocker");
    if (blockAction) {
      console.log(`[bot] Blocking with ${cardName(blockAction.blockerId)}`);
      submit(blockAction);
    } else if (skipAction) {
      console.log("[bot] Skipping blockers");
      submit(skipAction);
    }
    return;
  }

  // Handle breach target — pick first
  if (pending?.type === "choose_breach_target") {
    const breachAction = legalActions.find(a => a.type === "damage_location");
    if (breachAction) {
      console.log(`[bot] Breaching: ${cardName(breachAction.locationInstanceId)}`);
      submit(breachAction);
      return;
    }
  }

  // Handle cost discount
  if (pending?.type === "choose_cost_discount") {
    const skipAction = legalActions.find(a => a.type === "skip_cost_discount");
    if (skipAction) {
      submit(skipAction);
      return;
    }
  }

  // Handle play order
  if (pending?.type === "choose_play_order") {
    const playAction = legalActions.find(a => a.type === "choose_play");
    const skipAction = legalActions.find(a => a.type === "skip_play");
    if (playAction) {
      submit(playAction);
    } else if (skipAction) {
      submit(skipAction);
    }
    return;
  }

  // Handle reveal for opponent discard
  if (pending?.type === "choose_reveal_for_opponent_discard") {
    const revealAction = legalActions.find(a => a.type === "choose_reveal_for_opponent_discard");
    if (revealAction) {
      submit(revealAction);
      return;
    }
  }

  // Normal turn actions — use a simple priority system
  const me = gameState.players[myPlayerId];
  const myCards = gameState.cards.filter(c => !c.hidden && c.owner === myPlayerId);
  const boardFollowers = myCards.filter(c => c.zone === "board" && cardDefs[c.definitionId]?.type === "follower");
  const handCards = myCards.filter(c => c.zone === "hand");

  // 1. Try to play a card from hand (prefer followers, then events, then locations)
  const playActions = legalActions.filter(a => a.type === "play_card");
  if (playActions.length > 0) {
    // Sort: prefer cheaper cards first so we can play more
    const sorted = playActions.sort((a, b) => {
      const cardA = myCards.find(c => c.instanceId === a.cardInstanceId);
      const cardB = myCards.find(c => c.instanceId === b.cardInstanceId);
      const costA = cardA ? (cardDefs[cardA.definitionId]?.cost ?? 99) : 99;
      const costB = cardB ? (cardDefs[cardB.definitionId]?.cost ?? 99) : 99;
      return costA - costB;
    });
    const chosen = sorted[0];
    console.log(`[bot] Playing: ${cardName(chosen.cardInstanceId)}`);
    submit(chosen);
    return;
  }

  // 2. Use abilities on board followers
  const abilityActions = legalActions.filter(a => a.type === "use_ability");
  if (abilityActions.length > 0) {
    const chosen = abilityActions[0];
    console.log(`[bot] Using ability: ${cardName(chosen.cardInstanceId)}`);
    submit(chosen);
    return;
  }

  // 3. Attack if we have ready followers
  const attackAction = legalActions.find(a => a.type === "attack");
  if (attackAction) {
    // Find all non-exhausted followers to attack with
    const readyFollowers = boardFollowers.filter(c => !c.exhausted);
    if (readyFollowers.length > 0) {
      console.log(`[bot] Attacking with ${readyFollowers.length} followers!`);
      submit({ type: "attack", attackerIds: readyFollowers.map(c => c.instanceId) });
      return;
    }
  }

  // 4. Develop a location
  const devAction = legalActions.find(a => a.type === "develop");
  if (devAction) {
    console.log(`[bot] Developing: ${cardName(devAction.locationInstanceId)}`);
    submit(devAction);
    return;
  }

  // 5. Gain mythium
  const mythiumAction = legalActions.find(a => a.type === "gain_mythium");
  if (mythiumAction) {
    console.log("[bot] Gaining mythium");
    submit(mythiumAction);
    return;
  }

  // 6. Draw a card
  const drawAction = legalActions.find(a => a.type === "draw_card");
  if (drawAction) {
    console.log("[bot] Drawing a card");
    submit(drawAction);
    return;
  }

  // 7. Buy standing
  const standingAction = legalActions.find(a => a.type === "buy_standing");
  if (standingAction) {
    console.log(`[bot] Buying standing: ${standingAction.guild}`);
    submit(standingAction);
    return;
  }

  // 8. End turn / pass
  const endAction = legalActions.find(a => a.type === "end_turn");
  if (endAction) {
    console.log("[bot] Ending turn");
    submit(endAction);
    return;
  }

  // Fallback — pick first legal action
  console.log(`[bot] Fallback: ${legalActions[0].type}`);
  submit(legalActions[0]);
}

function submit(action) {
  socket.emit("submit_action", { action });
}

// Go!
console.log("[bot] Starting up...");
socket.connect();
