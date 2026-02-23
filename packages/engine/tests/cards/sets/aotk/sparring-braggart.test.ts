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

describe('Sparring Braggart', () => {
  hasPlayCost('sparring_braggart', 3, { earth: 2 });

  it('prevents weaker co-attackers from being blocked', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 2)
      .addCard('sparring_braggart', 'player1', 'board', { instanceId: 'braggart1' })
      .addCard('gallant_soldier', 'player1', 'board', { instanceId: 'soldier1' }) // 2 strength < 3
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'blocker1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['braggart1', 'soldier1'] },
    });

    const actions = getLegalActions(result.state);
    const blockerActions = actions.filter(a => a.action.type === 'declare_blocker');
    // Only the braggart can be blocked, not the soldier
    const blockerTargets = blockerActions.map(a =>
      a.action.type === 'declare_blocker' ? a.action.attackerId : null
    );
    expect(blockerTargets).toContain('braggart1');
    expect(blockerTargets).not.toContain('soldier1');
  });

  it('allows co-attackers with equal or greater strength to be blocked', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 2)
      .addCard('sparring_braggart', 'player1', 'board', { instanceId: 'braggart1' })
      .addCard('forbidding_guru', 'player1', 'board', { instanceId: 'guru1' }) // 3 strength = 3
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'blocker1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['braggart1', 'guru1'] },
    });

    const actions = getLegalActions(result.state);
    const blockerActions = actions.filter(a => a.action.type === 'declare_blocker');
    const blockerTargets = blockerActions.map(a =>
      a.action.type === 'declare_blocker' ? a.action.attackerId : null
    );
    expect(blockerTargets).toContain('braggart1');
    expect(blockerTargets).toContain('guru1');
  });

  it('blocking sparring braggart removes it from combat, allowing weaker attackers to be blocked', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 2)
      .addCard('sparring_braggart', 'player1', 'board', { instanceId: 'braggart1' })
      .addCard('gallant_soldier', 'player1', 'board', { instanceId: 'soldier1' }) // 2 strength
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'blocker1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blocker2' })
      .build();

    // Attack with both
    let result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['braggart1', 'soldier1'] },
    });

    // Block the braggart (which removes it from combat)
    result = processAction(result.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'blocker1', attackerId: 'braggart1' },
    });

    // Now the soldier should be blockable since braggart is removed
    const actions = getLegalActions(result.state);
    const blockerActions = actions.filter(a => a.action.type === 'declare_blocker');
    const blockerTargets = blockerActions.map(a =>
      a.action.type === 'declare_blocker' ? a.action.attackerId : null
    );
    expect(blockerTargets).toContain('soldier1');
  });
});
