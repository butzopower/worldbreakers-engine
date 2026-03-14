import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone, expectHandSize } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Marco Polo, Robed in Silk', () => {
  it('offers response trigger when controller plays a location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'earth', 1)
      .addCard('marco_polo_robed_in_silk', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'loc1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    });

    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_trigger_order');
  });

  it('draws the top card when it is a follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'earth', 1)
      .addCard('marco_polo_robed_in_silk', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'loc1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    });

    // Accept the trigger
    const triggerResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_trigger', triggerIndex: 0 },
    });

    // Follower should be drawn to hand
    expectCardInZone(triggerResult.state, 'deck1', 'hand');
  });

  it('puts non-follower card on the bottom of the deck', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'earth', 1)
      .addCard('marco_polo_robed_in_silk', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'loc1' })
      .addCard('sudden_strike', 'player1', 'deck', { instanceId: 'deck1' }) // event, not follower
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck2' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    });

    const triggerResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_trigger', triggerIndex: 0 },
    });

    // Event stays in deck (moved to bottom)
    expectCardInZone(triggerResult.state, 'deck1', 'deck');
    // militia_scout should now be the top card (deck1 moved to bottom)
    const deck = triggerResult.state.cards.filter(c => c.owner === 'player1' && c.zone === 'deck');
    expect(deck[0].instanceId).toBe('deck2');
    expect(deck[deck.length - 1].instanceId).toBe('deck1');
  });

  it('exhausts the worldbreaker when the response is used', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'earth', 1)
      .addCard('marco_polo_robed_in_silk', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'loc1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    });

    const triggerResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_trigger', triggerIndex: 0 },
    });

    const wb = triggerResult.state.cards.find(c => c.instanceId === 'wb1')!;
    expect(wb.exhausted).toBe(true);
  });

  it('does not offer trigger when worldbreaker is already exhausted', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'earth', 1)
      .addCard('marco_polo_robed_in_silk', 'player1', 'worldbreaker', { instanceId: 'wb1', exhausted: true })
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'loc1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    });

    // Should not have a trigger choice — ability requires exhaust and WB is already exhausted
    expect(result.state.pendingChoice?.type).not.toBe('choose_trigger_order');
  });

  it('can be skipped as an optional response', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'earth', 1)
      .addCard('marco_polo_robed_in_silk', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'loc1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    });

    // Skip the trigger
    const skipResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'skip_trigger', triggerIndex: 0 },
    });

    // Worldbreaker should not be exhausted
    const wb = skipResult.state.cards.find(c => c.instanceId === 'wb1')!;
    expect(wb.exhausted).toBe(false);
    // Card should still be in deck
    expectCardInZone(skipResult.state, 'deck1', 'deck');
  });

  it('does nothing when the deck is empty', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'earth', 1)
      .addCard('marco_polo_robed_in_silk', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'loc1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    });

    const triggerResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_trigger', triggerIndex: 0 },
    });

    // Worldbreaker should still exhaust even with empty deck
    const wb = triggerResult.state.cards.find(c => c.instanceId === 'wb1')!;
    expect(wb.exhausted).toBe(true);
  });

  it('does not trigger when the opponent plays a location', () => {
    const state = buildState()
      .withActivePlayer('player2')
      .withMythium('player2', 10)
      .withStanding('player2', 'earth', 1)
      .addCard('marco_polo_robed_in_silk', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('watchtower', 'player2', 'hand', { instanceId: 'loc1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player2',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    });

    // Should not trigger for opponent's location play
    expect(result.state.pendingChoice?.type).not.toBe('choose_trigger_order');
    const wb = result.state.cards.find(c => c.instanceId === 'wb1')!;
    expect(wb.exhausted).toBe(false);
  });

  it('does not trigger when a follower is played', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .addCard('marco_polo_robed_in_silk', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'f1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'f1' },
    });

    // Should not trigger for non-location plays
    expect(result.state.pendingChoice?.type).not.toBe('choose_trigger_order');
  });
});
