import { opponentOf, PlayerId, StandingGuild, Zone } from '../types/core';
import { GameState, CardInstance, LastingEffect, PendingChoice } from '../types/state';
import { CounterType, addCounter as addCounterToMap, getCounter } from '../types/counters';
import { GameEvent } from '../types/events';
import { seededShuffle } from '../utils/random';

export interface MutationResult {
  state: GameState;
  events: GameEvent[];
}

function bump(state: GameState): GameState {
  return { ...state, version: state.version + 1 };
}

export function shuffleDeck(
  state: GameState,
  player: PlayerId,
): MutationResult {
  const playerDeck = state.cards.filter(c => c.owner === player && c.zone === 'deck');
  const notDeck = state.cards.filter(c => c.owner === opponentOf(player) || (c.owner === player && c.zone !== 'deck'));

  const [shuffledDeck, nextRNG] = seededShuffle(playerDeck, state.rngState);

  const newState = bump({
    ...state,
    cards: [...notDeck, ...shuffledDeck],
    rngState: nextRNG,
  })

  return {
    state: newState,
    events: [{ type: 'deck_shuffled', player }],
  }
}

export function moveCard(
  state: GameState,
  instanceId: string,
  toZone: Zone,
): MutationResult {
  const card = state.cards.find(c => c.instanceId === instanceId);
  if (!card) return { state, events: [] };

  const fromZone = card.zone;
  if (fromZone === toZone) return { state, events: [] };

  const leavingBoard = fromZone === 'board' && toZone !== 'board';

  const newCard: CardInstance = {
    ...card,
    zone: toZone,
    // Reset state when leaving board
    exhausted: toZone === 'board' ? card.exhausted : false,
    counters: toZone === 'board' ? card.counters : {},
    // Clear storage tracking when leaving board
    storedCards: leavingBoard ? [] : card.storedCards,
  };

  // When a card with stored cards leaves the board, discard all stored cards
  const storedCardIds = leavingBoard ? card.storedCards : [];

  const newState = bump({
    ...state,
    cards: state.cards.map(c => {
      if (c.instanceId === instanceId) return newCard;
      // Discard stored cards and clear their storedOn reference
      if (storedCardIds.includes(c.instanceId)) {
        return { ...c, zone: 'discard' as Zone, storedOn: null, exhausted: false, counters: {} };
      }
      return c;
    }),
  });

  // Update hand size tracking
  let finalState = newState;
  if (fromZone === 'hand') {
    finalState = adjustHandSize(finalState, card.owner, -1);
  }
  if (toZone === 'hand') {
    finalState = adjustHandSize(finalState, card.owner, 1);
  }

  const events: GameEvent[] = [{ type: 'card_moved', cardInstanceId: instanceId, from: fromZone, to: toZone }];
  for (const storedId of storedCardIds) {
    events.push({ type: 'card_moved', cardInstanceId: storedId, from: 'stored', to: 'discard' });
  }

  return {
    state: finalState,
    events,
  };
}

export function moveCardToDeckBottom(
  state: GameState,
  instanceId: string,
): MutationResult {
  const card = state.cards.find(c => c.instanceId === instanceId);
  if (!card) return { state, events: [] };

  const fromZone = card.zone;
  const newCard: CardInstance = {
    ...card,
    zone: 'deck',
    exhausted: false,
    counters: {},
  };

  // Remove the card and append at the end (bottom of deck)
  const otherCards = state.cards.filter(c => c.instanceId !== instanceId);
  const newState = bump({
    ...state,
    cards: [...otherCards, newCard],
  });

  let finalState = newState;
  if (fromZone === 'hand') {
    finalState = adjustHandSize(finalState, card.owner, -1);
  }

  return {
    state: finalState,
    events: [{ type: 'card_moved', cardInstanceId: instanceId, from: fromZone, to: 'deck' }],
  };
}

function adjustHandSize(state: GameState, player: PlayerId, delta: number): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        handSize: state.players[player].handSize + delta,
      },
    },
  };
}

export function addCounterToCard(
  state: GameState,
  instanceId: string,
  counter: CounterType,
  amount: number,
): MutationResult {
  const card = state.cards.find(c => c.instanceId === instanceId);
  if (!card || amount <= 0) return { state, events: [] };

  const newCounters = addCounterToMap(card.counters, counter, amount);
  const newTotal = getCounter(newCounters, counter);

  const newState = bump({
    ...state,
    cards: state.cards.map(c =>
      c.instanceId === instanceId ? { ...c, counters: newCounters } : c
    ),
  });

  return {
    state: newState,
    events: [{ type: 'counter_added', cardInstanceId: instanceId, counter, amount, newTotal }],
  };
}

export function removeCounterFromCard(
  state: GameState,
  instanceId: string,
  counter: CounterType,
  amount: number,
): MutationResult {
  const card = state.cards.find(c => c.instanceId === instanceId);
  if (!card || amount <= 0) return { state, events: [] };

  const current = getCounter(card.counters, counter);
  const actualRemoved = Math.min(current, amount);
  if (actualRemoved <= 0) return { state, events: [] };

  const newCounters = addCounterToMap(card.counters, counter, -actualRemoved);
  const newTotal = getCounter(newCounters, counter);

  const newState = bump({
    ...state,
    cards: state.cards.map(c =>
      c.instanceId === instanceId ? { ...c, counters: newCounters } : c
    ),
  });

  return {
    state: newState,
    events: [{ type: 'counter_removed', cardInstanceId: instanceId, counter, amount: actualRemoved, newTotal }],
  };
}

export function exhaustCard(state: GameState, instanceId: string): MutationResult {
  const newState = bump({
    ...state,
    cards: state.cards.map(c =>
      c.instanceId === instanceId ? { ...c, exhausted: true } : c
    ),
  });
  return {
    state: newState,
    events: [{ type: 'card_exhausted', cardInstanceId: instanceId }],
  };
}

export function readyCard(state: GameState, instanceId: string): MutationResult {
  const card = state.cards.find(c => c.instanceId === instanceId);
  if (!card || !card.exhausted) return { state, events: [] };

  const newState = bump({
    ...state,
    cards: state.cards.map(c =>
      c.instanceId === instanceId ? { ...c, exhausted: false } : c
    ),
  });
  return {
    state: newState,
    events: [{ type: 'card_readied', cardInstanceId: instanceId }],
  };
}

export function gainMythium(state: GameState, player: PlayerId, amount: number): MutationResult {
  if (amount <= 0) return { state, events: [] };
  const newState = bump({
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        mythium: state.players[player].mythium + amount,
      },
    },
  });
  return {
    state: newState,
    events: [{ type: 'mythium_gained', player, amount }],
  };
}

export function spendMythium(state: GameState, player: PlayerId, amount: number): MutationResult {
  if (amount <= 0) return { state, events: [] };
  const newState = bump({
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        mythium: state.players[player].mythium - amount,
      },
    },
  });
  return {
    state: newState,
    events: [{ type: 'mythium_spent', player, amount }],
  };
}

export function loseMythium(state: GameState, player: PlayerId, amount: number): MutationResult {
  if (amount <= 0) return { state, events: [] };
  const current = state.players[player].mythium;
  const actual = Math.min(amount, current);
  if (actual <= 0) return { state, events: [] };
  const newState = bump({
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        mythium: current - actual,
      },
    },
  });
  return {
    state: newState,
    events: [{ type: 'mythium_spent', player, amount: actual }],
  };
}

export function gainPower(state: GameState, player: PlayerId, amount: number): MutationResult {
  if (amount <= 0) return { state, events: [] };
  const newState = bump({
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        power: state.players[player].power + amount,
      },
    },
  });
  return {
    state: newState,
    events: [{ type: 'power_gained', player, amount }],
  };
}

export function losePower(state: GameState, player: PlayerId, amount: number): MutationResult {
  if (amount <= 0) return { state, events: [] };
  const current = state.players[player].power;
  const actual = Math.min(amount, current);
  if (actual <= 0) return { state, events: [] };
  const newState = bump({
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        power: current - actual,
      },
    },
  });
  return {
    state: newState,
    events: [{ type: 'power_lost', player, amount: actual }],
  };
}

export function gainStanding(
  state: GameState,
  player: PlayerId,
  guild: StandingGuild,
  amount: number,
): MutationResult {
  if (amount <= 0) return { state, events: [] };
  const newState = bump({
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        standing: {
          ...state.players[player].standing,
          [guild]: state.players[player].standing[guild] + amount,
        },
      },
    },
  });
  return {
    state: newState,
    events: [{ type: 'standing_gained', player, guild, amount }],
  };
}

export function loseStanding(
  state: GameState,
  player: PlayerId,
  guild: StandingGuild,
  amount: number,
): MutationResult {
  if (amount <= 0) return { state, events: [] };
  const current = state.players[player].standing[guild];
  const loss = Math.min(amount, current);
  if (loss === 0) return { state, events: [] };
  const newState = bump({
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        standing: {
          ...state.players[player].standing,
          [guild]: current - loss,
        },
      },
    },
  });
  return {
    state: newState,
    events: [{ type: 'standing_gained', player, guild, amount: -loss }],
  };
}

export function drawCard(state: GameState, player: PlayerId): MutationResult {
  const deckCards = state.cards.filter(c => c.owner === player && c.zone === 'deck');
  if (deckCards.length === 0) {
    return { state, events: [] };
  }

  const topCard = deckCards[0];
  return moveCard(state, topCard.instanceId, 'hand');
}

export function addLastingEffect(state: GameState, effect: LastingEffect): MutationResult {
  const newState = bump({
    ...state,
    lastingEffects: [...state.lastingEffects, effect],
  });
  return {
    state: newState,
    events: [{ type: 'lasting_effect_created', effectId: effect.id, description: `${effect.type} +${effect.amount}` }],
  };
}

export function removeLastingEffect(state: GameState, effectId: string): MutationResult {
  const newState = bump({
    ...state,
    lastingEffects: state.lastingEffects.filter(e => e.id !== effectId),
  });
  return {
    state: newState,
    events: [{ type: 'lasting_effect_expired', effectId }],
  };
}

export function destroy(
  state: GameState,
  instanceId: string,
): MutationResult {
  const card = state.cards.find(c => c.instanceId === instanceId);
  if (!card) return { state, events: [] };

  const newState = bump({
    ...state,
    cards: state.cards.map(c =>
      c.instanceId === instanceId ? { ...c, markAsDestroyed: true } : c
    ),
  });

  return {
    state: newState,
    events: [],
  };
}

export function setPendingChoice(
  state: GameState,
  pendingChoice: PendingChoice
): MutationResult {
  if (state.pendingChoice) {
    throw new Error("Pending choice already has been set")
  }

  const newState = bump({
    ...state,
    pendingChoice: pendingChoice,
  })

  return { state: newState, events: [] }
}

export function setActivePlayer(state: GameState, player: PlayerId): GameState {
  return bump({ ...state, activePlayer: player });
}

export function storeCard(
  state: GameState,
  cardInstanceId: string,
  hostInstanceId: string,
): MutationResult {
  const card = state.cards.find(c => c.instanceId === cardInstanceId);
  const host = state.cards.find(c => c.instanceId === hostInstanceId);
  if (!card || !host) return { state, events: [] };

  const fromZone = card.zone;

  const newState = bump({
    ...state,
    cards: state.cards.map(c => {
      if (c.instanceId === cardInstanceId) {
        return { ...c, zone: 'stored' as Zone, storedOn: hostInstanceId, exhausted: false, counters: {} };
      }
      if (c.instanceId === hostInstanceId) {
        return { ...c, storedCards: [...c.storedCards, cardInstanceId] };
      }
      return c;
    }),
  });

  let finalState = newState;
  if (fromZone === 'hand') {
    finalState = adjustHandSize(finalState, card.owner, -1);
  }

  return {
    state: finalState,
    events: [{ type: 'card_moved', cardInstanceId, from: fromZone, to: 'stored' }],
  };
}

export function unstoreCard(
  state: GameState,
  cardInstanceId: string,
): MutationResult {
  const card = state.cards.find(c => c.instanceId === cardInstanceId);
  if (!card || !card.storedOn) return { state, events: [] };

  const hostId = card.storedOn;

  const newState = bump({
    ...state,
    cards: state.cards.map(c => {
      if (c.instanceId === cardInstanceId) {
        return { ...c, storedOn: null };
      }
      if (c.instanceId === hostId) {
        return { ...c, storedCards: c.storedCards.filter(id => id !== cardInstanceId) };
      }
      return c;
    }),
  });

  return { state: newState, events: [] };
}

export function incrementActions(state: GameState): GameState {
  return { ...state, actionsTaken: state.actionsTaken + 1 };
}
