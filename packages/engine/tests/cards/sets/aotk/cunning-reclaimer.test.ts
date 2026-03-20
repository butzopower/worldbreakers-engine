import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Cunning Reclaimer', () => {
  hasPlayCost('cunning_reclaimer', 3, { void: 1 });

  it('when attacking alone, lets you choose an opponent follower that cannot block', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'void', 1)
      .addCard('cunning_reclaimer', 'player1', 'board', { instanceId: 'cr1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['cr1'] },
    });

    // Should present target choice for opponent follower
    expect(attackResult.waitingFor?.type).toBe('choose_target');

    // Choose shield_bearer — it can't block this combat
    const chooseResult = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    // Should now be at blocker declaration
    expect(chooseResult.waitingFor?.type).toBe('choose_blockers');

    // The only legal action should be pass_block since sb1 can't block
    const legalActions = getLegalActions(chooseResult.state);
    const blockerActions = legalActions.filter(a => a.action.type === 'declare_blocker');
    expect(blockerActions).toHaveLength(0);
  });

  it('does not trigger when attacking with other followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'void', 1)
      .addCard('cunning_reclaimer', 'player1', 'board', { instanceId: 'cr1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['cr1', 'ms1'] },
    });

    // Should go straight to blocker declaration — no target choice
    expect(attackResult.waitingFor?.type).toBe('choose_blockers');

    // shield_bearer should still be able to block
    const legalActions = getLegalActions(attackResult.state);
    const blockerActions = legalActions.filter(a => a.action.type === 'declare_blocker');
    expect(blockerActions.length).toBeGreaterThan(0);
  });

  it('only prevents chosen follower from blocking, not others', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'void', 1)
      .addCard('cunning_reclaimer', 'player1', 'board', { instanceId: 'cr1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'eg1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['cr1'] },
    });

    // Choose shield_bearer to not block
    const chooseResult = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    expect(chooseResult.waitingFor?.type).toBe('choose_blockers');

    // earthshaker_giant should still be able to block
    const legalActions = getLegalActions(chooseResult.state);
    const blockerActions = legalActions.filter(a => a.action.type === 'declare_blocker');
    expect(blockerActions).toHaveLength(1);
    expect(blockerActions[0].action).toEqual({ type: 'declare_blocker', blockerId: 'eg1', attackerId: 'cr1' });
  });
});
