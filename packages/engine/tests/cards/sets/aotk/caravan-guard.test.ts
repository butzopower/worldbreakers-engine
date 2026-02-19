import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Caravan Guard', () => {
  hasPlayCost('caravan_guard', 2);

  it('enters the board when played', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .addCard('caravan_guard', 'player1', 'hand', { instanceId: 'cg1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'cg1' },
    });

    expectCardInZone(result.state, 'cg1', 'board');
  });

  it('stationary — cannot attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('caravan_guard', 'player1', 'board', { instanceId: 'cg1' })
      .build();

    const actions = getLegalActions(state);
    const canAttack = actions.some(
      a => a.action.type === 'attack' && a.action.attackerIds.includes('cg1'),
    );
    expect(canAttack).toBe(false);
  });

  it('stationary — can still block', () => {
    const state = buildState()
      .withActivePlayer('player2')
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .addCard('caravan_guard', 'player1', 'board', { instanceId: 'cg1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player2',
      action: { type: 'attack', attackerIds: ['ms1'] },
    });

    const actions = getLegalActions(attackResult.state);
    const canBlock = actions.some(
      a => a.action.type === 'declare_blocker' && a.action.blockerId === 'cg1',
    );
    expect(canBlock).toBe(true);
  });

  it('has 2 strength and 4 health — survives a 2-strength attacker', () => {
    // militia_scout (1 str) attacks, caravan_guard blocks — guard survives with 1 wound
    const state = buildState()
      .withActivePlayer('player2')
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .addCard('caravan_guard', 'player1', 'board', { instanceId: 'cg1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player2',
      action: { type: 'attack', attackerIds: ['ms1'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'declare_blocker', blockerId: 'cg1', attackerId: 'ms1' },
    });

    // militia_scout (1 health) defeated by caravan_guard (2 str)
    expectCardInZone(blockResult.state, 'ms1', 'discard');
    // caravan_guard (4 health) survives 1 wound from militia_scout
    expectCardInZone(blockResult.state, 'cg1', 'board');
  });
});
