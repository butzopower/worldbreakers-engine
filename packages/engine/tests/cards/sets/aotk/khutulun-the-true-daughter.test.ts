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

describe('Khutulun, the True Daughter', () => {
  it('increases a single follower\'s attack by 1 during controller\'s attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('khutulun_the_true_daughter', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' }) // 1/1
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk2' }) // 1/1
      .addCard('stars_apprentice', 'player2', 'board', { instanceId: 'blk1' }) // 2/2
      .addCard('stars_apprentice', 'player2', 'board', { instanceId: 'blk2' }) // 2/2
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1', 'atk2'] },
    });

    const increaseStrengthResult = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'atk1' },
    });

    const blockResult1 = processAction(increaseStrengthResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'blk1', attackerId: 'atk1' },
    });

    // blk1 should be defeated due to str increase on atk1
    expectCardInZone(blockResult1.state, 'blk1', 'discard');

    const blockResult2 = processAction(blockResult1.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'blk2', attackerId: 'atk2' },
    });

    // blk2 should not be defeated due to no str increase on atk2
    expectCardInZone(blockResult1.state, 'blk2', 'board');
  });
});
