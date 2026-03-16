import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Inspirational Vision', () => {
  hasPlayCost('inspirational_vision', 2, { stars: 1 });

  it('prompts to choose follower or location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('inspirational_vision', 'player1', 'hand', { instanceId: 'iv1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'iv1' },
    });

    expect(result.waitingFor?.type).toBe('choose_mode');
  });

  it('choosing follower reveals cards until a follower is found', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('inspirational_vision', 'player1', 'hand', { instanceId: 'iv1' })
      .addCard('mother_lode', 'player1', 'deck', { instanceId: 'ev1' })
      .addCard('mother_lode', 'player1', 'deck', { instanceId: 'ev2' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'iv1' },
    });

    // Choose follower (mode 0)
    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // Reveals event, event, then finds follower - should prompt draw or play
    expect(result.waitingFor?.type).toBe('choose_mode');
    // The revealed events should still be in deck (shuffled)
    expectCardInZone(result.state, 'ev1', 'deck');
    expectCardInZone(result.state, 'ev2', 'deck');
    // The found follower should be in hand
    expectCardInZone(result.state, 'ms1', 'hand');
  });

  it('choosing draw keeps the found card in hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('inspirational_vision', 'player1', 'hand', { instanceId: 'iv1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'iv1' },
    });

    // Choose follower
    const modeResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // Choose draw (mode 0)
    const result = processAction(modeResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expectCardInZone(result.state, 'ms1', 'hand');
    expect(result.state.pendingChoice).toBeNull();
  });

  it('choosing play puts the found card on the board paying 2 less', () => {
    // militia_scout costs 1, so with 2 discount it should cost 0
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 3) // 2 for IV + 0 for discounted scout
      .addCard('inspirational_vision', 'player1', 'hand', { instanceId: 'iv1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'iv1' },
    });

    // Choose follower
    const modeResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // Choose play (mode 1)
    const playModeResult = processAction(modeResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    // Select the card to play
    const result = processAction(playModeResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectCardInZone(result.state, 'ms1', 'board');
    // Started with 3, paid 2 for IV, 0 for scout (1 - 2 discount = 0)
    expect(result.state.players.player1.mythium).toBe(1);
  });

  it('choosing location reveals cards until a location is found', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('inspirational_vision', 'player1', 'hand', { instanceId: 'iv1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('the_humble_underpass', 'player1', 'deck', { instanceId: 'loc1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'iv1' },
    });

    // Choose location (mode 1)
    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    // Reveals follower, then finds location - should prompt draw or play
    expect(result.waitingFor?.type).toBe('choose_mode');
    expectCardInZone(result.state, 'ms1', 'deck');
    expectCardInZone(result.state, 'loc1', 'hand');
  });

  it('playing a found location pays 2 less', () => {
    // the_humble_underpass costs 2, with 2 discount = 0
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('inspirational_vision', 'player1', 'hand', { instanceId: 'iv1' })
      .addCard('the_humble_underpass', 'player1', 'deck', { instanceId: 'loc1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'iv1' },
    });

    // Choose location
    const modeResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    // Choose play (mode 1)
    const playModeResult = processAction(modeResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    // Select the card to play
    const result = processAction(playModeResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'loc1' },
    });

    expectCardInZone(result.state, 'loc1', 'board');
    // Started with 5, paid 2 for IV, 0 for location (2 - 2 discount = 0)
    expect(result.state.players.player1.mythium).toBe(3);
  });

  it('shuffles the deck after resolving', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('inspirational_vision', 'player1', 'hand', { instanceId: 'iv1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'iv1' },
    });

    // Choose follower — the shuffle happens during this resolution (before draw/play choice)
    const modeResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    const shuffleEvent = modeResult.events.find(e => e.type === 'deck_shuffled');
    expect(shuffleEvent).toBeDefined();
  });

  it('handles empty deck gracefully', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('inspirational_vision', 'player1', 'hand', { instanceId: 'iv1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'iv1' },
    });

    // Choose follower
    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // No card found, just shuffles and resolves
    expect(result.state.pendingChoice).toBeNull();
  });

  it('no matching card type in deck just shuffles', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('inspirational_vision', 'player1', 'hand', { instanceId: 'iv1' })
      .addCard('mother_lode', 'player1', 'deck', { instanceId: 'ev1' })
      .addCard('mother_lode', 'player1', 'deck', { instanceId: 'ev2' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'iv1' },
    });

    // Choose follower - no followers in deck
    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // No follower found, resolves without further choice
    expect(result.state.pendingChoice).toBeNull();
  });
});
