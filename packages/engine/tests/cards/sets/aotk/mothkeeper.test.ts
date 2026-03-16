import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { hasPlayCost } from '../../../helpers/properties';
import { autoAccept } from '../../../helpers/game';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Mothkeeper', () => {
  hasPlayCost('mothkeeper', 2, { stars: 1 });

  it('gains 2 mythium the first time you gain power this round', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 10)
      .addCard('mothkeeper', 'player1', 'board', { instanceId: 'mk1' })
      .addCard('the_humble_underpass', 'player1', 'board', { instanceId: 'loc1', counters: { stage: 2 } })
      .build();

    // Develop underpass — stage I grants 2 mythium and 1 power
    // The power gain should trigger mothkeeper
    const result = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'loc1' },
    }));

    // 10 + 2 (underpass mythium) + 2 (mothkeeper) = 14
    expect(result.state.players.player1.mythium).toBe(14);
    expect(result.state.players.player1.power).toBe(1);
  });

  it('does not trigger a second time in the same round', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 10)
      .withMythium('player2', 10)
      .addCard('mothkeeper', 'player1', 'board', { instanceId: 'mk1' })
      .addCard('the_humble_underpass', 'player1', 'board', { instanceId: 'loc1', counters: { stage: 2 } })
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'loc2', counters: { stage: 3 } })
      .build();

    // Develop underpass — stage I grants 1 power, triggers mothkeeper
    const firstDev = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'loc1' },
    }));

    // 10 + 2 (underpass mythium) + 2 (mothkeeper) = 14
    expect(firstDev.state.players.player1.mythium).toBe(14);
    expect(firstDev.state.players.player1.powerGainedThisRound).toBe(true);

    // Player 2 takes an action
    const p2Action = processAction(firstDev.state, {
      player: 'player2',
      action: { type: 'gain_mythium' },
    });

    // Develop indigo grotto — stage I grants 2 power, should NOT trigger mothkeeper again
    const secondDev = processAction(p2Action.state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'loc2' },
    });

    // No trigger prompt — mothkeeper already used this round
    expect(secondDev.state.pendingChoice).toBeNull();
    // 14 mythium unchanged (no mothkeeper bonus)
    expect(secondDev.state.players.player1.mythium).toBe(14);
    // Power: 1 (underpass) + 2 (grotto) = 3
    expect(secondDev.state.players.player1.power).toBe(3);
  });

  it('resets at the start of a new round', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withFirstPlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 10)
      .withMythium('player2', 10)
      .addCard('mothkeeper', 'player1', 'board', { instanceId: 'mk1' })
      .addCard('the_humble_underpass', 'player1', 'board', { instanceId: 'loc1', counters: { stage: 2 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .addCard('militia_scout', 'player2', 'deck', { instanceId: 'deck2' })
      .build();

    // Develop underpass — triggers mothkeeper
    const firstDev = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'loc1' },
    }));

    expect(firstDev.state.players.player1.powerGainedThisRound).toBe(true);

    // Fast-forward to next round
    let current = firstDev;
    while (current.state.round === 1) {
      current = processAction(current.state, {
        player: current.state.activePlayer,
        action: { type: 'gain_mythium' },
      });
    }

    // New round — flag should be reset
    expect(current.state.players.player1.powerGainedThisRound).toBe(false);
  });
});
