import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { hasPlayCost } from "../../../helpers/properties";

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Forbidding Guru', () => {
  hasPlayCost('forbidding_guru', 3, { earth: 2 });

  it('cannot be blocked by followers with strength 3 or greater', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 2)
      .addCard('forbidding_guru', 'player1', 'board', { instanceId: 'guru1' })
      .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'blocker1' }) // 3 strength
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['guru1'] },
    });

    const actions = getLegalActions(result.state);
    const blockerActions = actions.filter(a => a.action.type === 'declare_blocker');
    expect(blockerActions).toHaveLength(0);
  });

  it('can be blocked by followers with strength less than 3', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 2)
      .addCard('forbidding_guru', 'player1', 'board', { instanceId: 'guru1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'blocker1' }) // 1 strength
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['guru1'] },
    });

    const actions = getLegalActions(result.state);
    const blockerActions = actions.filter(a => a.action.type === 'declare_blocker');
    expect(blockerActions.length).toBeGreaterThan(0);
  });
});
