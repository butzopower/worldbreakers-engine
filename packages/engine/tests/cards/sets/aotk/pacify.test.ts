import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction, getLegalActions } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectCardInZone, expectCardCounter } from '../../../helpers/assertions';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Pacify', () => {
  hasPlayCost('pacify', 3, { stars: 1 });

  it('puts a stationary counter on a follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'stars', 1)
      .addCard('pacify', 'player1', 'hand', { instanceId: 'pac1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    // Play Pacify targeting opponent's scout
    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pac1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    // Turn advanced to player2 — their only follower has stationary, so no attack available
    expect(chooseResult.state.activePlayer).toBe('player2');

    expectCardCounter(chooseResult.state, 'ms1', 'stationary', 1);
    const actions = getLegalActions(chooseResult.state);
    const attackActions = actions.filter(a => a.action.type === 'attack');
    expect(attackActions).toHaveLength(0);
  });

  it('can target own followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 1)
      .addCard('pacify', 'player1', 'hand', { instanceId: 'pac1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pac1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectCardCounter(chooseResult.state, 'ms1', 'stationary', 1);
  });

  it('event goes to discard after playing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 1)
      .addCard('pacify', 'player1', 'hand', { instanceId: 'pac1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pac1' },
    });

    expectCardInZone(playResult.state, 'pac1', 'discard');
  });
});
