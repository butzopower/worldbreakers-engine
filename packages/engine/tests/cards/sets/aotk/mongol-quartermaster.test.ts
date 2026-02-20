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

describe('Mongol Quartermaster', () => {
  hasPlayCost('mongol_quartermaster', 5, { earth: 1 });

  it('migrate: choosing gain gives 1 earth standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 5)
      .addCard('mongol_quartermaster', 'player1', 'hand', { instanceId: 'mq1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'mq1' },
    });

    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(result.state.players.player1.standing.earth).toBe(2);
  });

  it('migrate: the chosen follower enters play paying 2 mythium less', () => {
    // After paying 5 for quartermaster, player has 0 mythium left.
    // militia_scout costs 1, reduced by 2 = free.
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 5)
      .addCard('mongol_quartermaster', 'player1', 'hand', { instanceId: 'mq1' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'mq1' },
    });

    const migrateResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    const chooseResult = processAction(migrateResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectCardInZone(chooseResult.state, 'ms1', 'board');
    expect(chooseResult.state.players.player1.mythium).toBe(0); // paid nothing (1 - 2, min 0)
  });
});
