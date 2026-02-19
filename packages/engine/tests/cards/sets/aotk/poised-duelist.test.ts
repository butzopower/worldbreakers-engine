import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone, expectCardCounter } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Poised Duelist', () => {
  hasPlayCost('poised_duelist', 2, { earth: 2 });

  it('enters without a +1/+1 counter when fewer than 2 other followers are on board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'earth', 2)
      .addCard('poised_duelist', 'player1', 'hand', { instanceId: 'pd1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pd1' },
    });

    expectCardInZone(result.state, 'pd1', 'board');
    expectCardCounter(result.state, 'pd1', 'plus_one_plus_one', 0);
  });

  it('enters with a +1/+1 counter when controlling at least 2 other followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'earth', 2)
      .addCard('poised_duelist', 'player1', 'hand', { instanceId: 'pd1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms2' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pd1' },
    });

    expectCardCounter(result.state, 'pd1', 'plus_one_plus_one', 1);
  });

  it('does not count opponent followers toward the condition', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'earth', 2)
      .addCard('poised_duelist', 'player1', 'hand', { instanceId: 'pd1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms2' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pd1' },
    });

    expectCardCounter(result.state, 'pd1', 'plus_one_plus_one', 0);
  });
});
