import { describe, it, expect, beforeEach } from 'vitest';
import { registerTestCards } from '../../src/cards/test-cards/index.js';
import { clearRegistry } from '../../src/cards/registry.js';
import { createGameState, GameConfig } from '../../src/state/create.js';
import { processAction, getLegalActions } from '../../src/engine/engine.js';
import { getHand, getDeck } from '../../src/state/query.js';

const TEST_CONFIG: GameConfig = {
  player1Deck: {
    worldbreakerId: 'stone_sentinel',
    cardIds: ['militia_scout', 'militia_scout', 'shield_bearer', 'night_raider', 'void_channeler',
              'star_warden', 'earthshaker_giant', 'sudden_strike', 'void_rift', 'watchtower'],
  },
  player2Deck: {
    worldbreakerId: 'void_oracle',
    cardIds: ['militia_scout', 'militia_scout', 'shield_bearer', 'night_raider', 'void_channeler',
              'star_warden', 'earthshaker_giant', 'sudden_strike', 'void_rift', 'void_nexus'],
  },
  seed: 42,
  firstPlayer: 'player1',
};

beforeEach(() => {
  clearRegistry();
  registerTestCards();
});

describe('mulligan', () => {
  it('game starts in mulligan phase with pending choice for first player', () => {
    const state = createGameState(TEST_CONFIG);

    expect(state.phase).toBe('mulligan');
    expect(state.pendingChoice).not.toBeNull();
    expect(state.pendingChoice!.type).toBe('choose_mulligan');
    expect(state.pendingChoice!.playerId).toBe('player1');
  });

  it('first player can keep their hand (mulligan 0 cards)', () => {
    const state = createGameState(TEST_CONFIG);
    const originalHand = getHand(state, 'player1').map(c => c.instanceId);

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'mulligan', cardInstanceIds: [] },
    });

    // Still in mulligan phase, waiting for player2
    expect(result.state.phase).toBe('mulligan');
    expect(result.state.pendingChoice!.type).toBe('choose_mulligan');
    expect(result.state.pendingChoice!.playerId).toBe('player2');

    // Hand is unchanged
    const newHand = getHand(result.state, 'player1').map(c => c.instanceId);
    expect(newHand).toEqual(originalHand);
  });

  it('first player can mulligan some cards and draw replacements', () => {
    const state = createGameState(TEST_CONFIG);
    const originalHand = getHand(state, 'player1');
    const cardsToMulligan = originalHand.slice(0, 2).map(c => c.instanceId);
    const keptCards = originalHand.slice(2).map(c => c.instanceId);

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'mulligan', cardInstanceIds: cardsToMulligan },
    });

    // Hand still has 5 cards
    const newHand = getHand(result.state, 'player1');
    expect(newHand.length).toBe(5);

    // Kept cards are still in hand
    for (const id of keptCards) {
      expect(newHand.some(c => c.instanceId === id)).toBe(true);
    }

    // Mulliganed cards are no longer in hand
    for (const id of cardsToMulligan) {
      expect(newHand.some(c => c.instanceId === id)).toBe(false);
    }

    // Mulliganed cards were shuffled back into deck
    const deck = getDeck(result.state, 'player1');
    for (const id of cardsToMulligan) {
      expect(deck.some(c => c.instanceId === id)).toBe(true);
    }
  });

  it('second player mulligan transitions to action phase', () => {
    const state = createGameState(TEST_CONFIG);

    // Player 1 keeps hand
    const afterP1 = processAction(state, {
      player: 'player1',
      action: { type: 'mulligan', cardInstanceIds: [] },
    });

    // Player 2 keeps hand
    const afterP2 = processAction(afterP1.state, {
      player: 'player2',
      action: { type: 'mulligan', cardInstanceIds: [] },
    });

    expect(afterP2.state.phase).toBe('action');
    expect(afterP2.state.pendingChoice).toBeNull();
    expect(afterP2.state.activePlayer).toBe('player1');
  });

  it('both players can mulligan cards', () => {
    const state = createGameState(TEST_CONFIG);
    const p1Hand = getHand(state, 'player1');
    const p2OriginalHand = getHand(state, 'player2');

    // Player 1 mulligans 3 cards
    const afterP1 = processAction(state, {
      player: 'player1',
      action: { type: 'mulligan', cardInstanceIds: p1Hand.slice(0, 3).map(c => c.instanceId) },
    });
    expect(getHand(afterP1.state, 'player1').length).toBe(5);

    // Player 2 mulligans 1 card
    const p2CardsToMulligan = [p2OriginalHand[0].instanceId];
    const afterP2 = processAction(afterP1.state, {
      player: 'player2',
      action: { type: 'mulligan', cardInstanceIds: p2CardsToMulligan },
    });

    expect(afterP2.state.phase).toBe('action');
    expect(getHand(afterP2.state, 'player2').length).toBe(5);
  });

  it('player can mulligan entire hand', () => {
    const state = createGameState(TEST_CONFIG);
    const originalHand = getHand(state, 'player1');
    const allIds = originalHand.map(c => c.instanceId);

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'mulligan', cardInstanceIds: allIds },
    });

    const newHand = getHand(result.state, 'player1');
    expect(newHand.length).toBe(5);

    // All original cards should now be in the deck
    const deck = getDeck(result.state, 'player1');
    for (const id of allIds) {
      expect(deck.some(c => c.instanceId === id)).toBe(true);
    }

    // New hand should have completely different cards
    for (const id of allIds) {
      expect(newHand.some(c => c.instanceId === id)).toBe(false);
    }
  });

  it('wrong player cannot mulligan', () => {
    const state = createGameState(TEST_CONFIG);

    expect(() => processAction(state, {
      player: 'player2',
      action: { type: 'mulligan', cardInstanceIds: [] },
    })).toThrow('Not your choice to make');
  });

  it('cannot mulligan cards not in hand', () => {
    const state = createGameState(TEST_CONFIG);
    const deckCards = getDeck(state, 'player1');

    expect(() => processAction(state, {
      player: 'player1',
      action: { type: 'mulligan', cardInstanceIds: [deckCards[0].instanceId] },
    })).toThrow('not in your hand');
  });

  it('getLegalActions includes mulligan options during mulligan phase', () => {
    const state = createGameState(TEST_CONFIG);
    const actions = getLegalActions(state);

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every(a => a.player === 'player1')).toBe(true);
    expect(actions.every(a => a.action.type === 'mulligan')).toBe(true);

    // Should include keeping hand (empty mulligan)
    expect(actions.some(a =>
      a.action.type === 'mulligan' && a.action.cardInstanceIds.length === 0
    )).toBe(true);
  });

  it('emits mulligan_complete events', () => {
    const state = createGameState(TEST_CONFIG);
    const hand = getHand(state, 'player1');

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'mulligan', cardInstanceIds: [hand[0].instanceId] },
    });

    const mulliganEvent = result.events.find(e => e.type === 'mulligan_complete');
    expect(mulliganEvent).toBeDefined();
    expect(mulliganEvent!.player).toBe('player1');
    expect(mulliganEvent!.cardsReturned).toBe(1);
  });

  it('skipMulligan config option skips mulligan phase', () => {
    const state = createGameState({ ...TEST_CONFIG, skipMulligan: true });

    expect(state.phase).toBe('action');
    expect(state.pendingChoice).toBeNull();
  });

  it('deck size is preserved after mulligan', () => {
    const state = createGameState(TEST_CONFIG);
    const deckBefore = getDeck(state, 'player1').length;
    const hand = getHand(state, 'player1');

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'mulligan', cardInstanceIds: hand.slice(0, 3).map(c => c.instanceId) },
    });

    const deckAfter = getDeck(result.state, 'player1').length;
    expect(deckAfter).toBe(deckBefore);
    expect(getHand(result.state, 'player1').length).toBe(5);
  });
});
