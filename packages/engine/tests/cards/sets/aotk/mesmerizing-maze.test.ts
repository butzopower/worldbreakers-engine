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

describe('Mesmerizing Maze', () => {
  hasPlayCost('mesmerizing_maze', 3, { stars: 1 });

  it('stage I grants 1 stars standing and 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 10)
      .addCard('mesmerizing_maze', 'player1', 'board', { instanceId: 'mm1', counters: { stage: 2 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'mm1' },
    });

    expect(result.state.players.player1.standing.stars).toBe(2);
    expect(result.state.players.player1.power).toBe(1);
  });

  it('stage II grants 1 power and lets you put a stationary counter on a follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 10)
      .addCard('mesmerizing_maze', 'player1', 'board', { instanceId: 'mm1', counters: { stage: 1 } })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'mm1' },
    });

    // Should prompt to choose a follower for stationary counter
    expect(result.waitingFor?.type).toBe('choose_target');

    const counterResult = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    const scout = counterResult.state.cards.find(c => c.instanceId === 'ms1')!;
    expect(scout.counters.stationary).toBe(1);
    expect(counterResult.state.players.player1.power).toBe(1);
    // Maze depletes after stage II
    expectCardInZone(counterResult.state, 'mm1', 'discard');
  });

  it('stage II can target opponent followers for stationary counter', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 10)
      .addCard('mesmerizing_maze', 'player1', 'board', { instanceId: 'mm1', counters: { stage: 1 } })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'mm1' },
    });

    expect(result.waitingFor?.type).toBe('choose_target');

    const counterResult = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    const scout = counterResult.state.cards.find(c => c.instanceId === 'ms1')!;
    expect(scout.counters.stationary).toBe(1);
  });
});
