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

describe('Vicious Stab', () => {
  hasPlayCost('vicious_stab', 1, { void: 1 });

  it('deals 2 wounds to a chosen follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'void', 1)
      .addCard('vicious_stab', 'player1', 'hand', { instanceId: 'vs1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' }) // 1/3
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'vs1' },
    });

    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    expectCardCounter(result.state, 'sb1', 'wound', 2);
    expectCardInZone(result.state, 'vs1', 'discard');
  });

  it('can target own followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'void', 1)
      .addCard('vicious_stab', 'player1', 'hand', { instanceId: 'vs1' })
      .addCard('shield_bearer', 'player1', 'board', { instanceId: 'sb1' }) // 1/3
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'vs1' },
    });

    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    expectCardCounter(result.state, 'sb1', 'wound', 2);
  });

  it('defeats a follower with 2 or less health', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'void', 1)
      .addCard('vicious_stab', 'player1', 'hand', { instanceId: 'vs1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' }) // 1/1
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'vs1' },
    });

    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectCardInZone(result.state, 'ms1', 'discard');
  });
});
