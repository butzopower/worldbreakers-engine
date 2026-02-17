import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectCardInZone } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Yam Operator', () => {
  it('creates a choose_target pending choice when a valid event is in hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('yam_operator', 'player1', 'hand', { instanceId: 'yo1' })
      .addCard('mythium_fund', 'player1', 'hand', { instanceId: 'mf1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'yo1' },
    });

    expectCardInZone(result.state, 'yo1', 'board');
    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_target');
  });

  it('plays the chosen event at 1 mythium less', () => {
    // mythium_fund costs 5, reduced by 1 = 4
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .addCard('yam_operator', 'player1', 'hand', { instanceId: 'yo1' })
      .addCard('mythium_fund', 'player1', 'hand', { instanceId: 'mf1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'yo1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'mf1' },
    });

    // 10 - 1 (yam operator cost) - 4 (mythium fund 5 - 1 reduction) + 9 (mythium fund effect) = 14
    expectPlayerMythium(chooseResult.state, 'player1', 14);
    expectCardInZone(chooseResult.state, 'mf1', 'discard');
  });

  it('fizzles when no valid events in hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('yam_operator', 'player1', 'hand', { instanceId: 'yo1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'yo1' },
    });

    expect(result.state.pendingChoice).toBeNull();
    expectCardInZone(result.state, 'yo1', 'board');
    expect(result.state.activePlayer).toBe('player2');
  });

  it('cannot choose an event the player cannot afford even with reduction', () => {
    // mythium_fund costs 5, reduced by 1 = 4. Player has only 1 mythium left after playing yam_operator.
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .addCard('yam_operator', 'player1', 'hand', { instanceId: 'yo1' })
      .addCard('mythium_fund', 'player1', 'hand', { instanceId: 'mf1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'yo1' },
    });

    // Can't afford mythium_fund (needs 4 after reduction, only 1 left) → fizzles
    expect(result.state.pendingChoice).toBeNull();
    expect(result.state.activePlayer).toBe('player2');
  });

  it('does not offer follower cards as targets', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('yam_operator', 'player1', 'hand', { instanceId: 'yo1' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'yo1' },
    });

    // militia_scout is a follower, not an event → fizzles
    expect(result.state.pendingChoice).toBeNull();
    expect(result.state.activePlayer).toBe('player2');
  });

  it('can play a 0-cost event for free', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'void', 1)
      .addCard('yam_operator', 'player1', 'hand', { instanceId: 'yo1' })
      .addCard('amazing_arithmetic', 'player1', 'hand', { instanceId: 'aa1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'yo1' },
    });

    expect(playResult.state.pendingChoice).not.toBeNull();

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'aa1' },
    });

    // amazing_arithmetic costs 0, gains 2 mythium, then presents choose_mode
    expectPlayerMythium(chooseResult.state, 'player1', 2); // 1 - 1 (yo cost) + 2 (aa effect)
    expectCardInZone(chooseResult.state, 'aa1', 'discard');
  });
});
