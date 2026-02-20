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

describe('Wild Boar Charge', () => {
  hasPlayCost('wild_boar_charge', 2, { earth: 1 });

  it('defeats a wounded follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 2)
      .addCard('wild_boar_charge', 'player1', 'hand', { instanceId: 'wbc1' })
      // shield_bearer is 1/3; with 1 wound it has 2 effective health — still targetable as wounded
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1', counters: { wound: 1 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'wbc1' },
    });

    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    expectCardInZone(result.state, 'sb1', 'discard');
  });

  it('does not target an unwounded follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 2)
      .addCard('wild_boar_charge', 'player1', 'hand', { instanceId: 'wbc1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'wbc1' },
    });

    // No valid targets — the choose_target prompt should not appear
    expect(playResult.waitingFor).toBeUndefined();
    // Unwounded follower remains on board
    expectCardInZone(playResult.state, 'sb1', 'board');
  });
});
