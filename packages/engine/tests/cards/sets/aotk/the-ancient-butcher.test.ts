import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectPlayerMythium, expectCardCounter } from '../../../helpers/assertions';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Ancient Butcher', () => {
  hasPlayCost('the_ancient_butcher', 6, { void: 3 });

  it('when attacking alone, presents pay X modes based on current mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .withStanding('player1', 'void', 3)
      .addCard('the_ancient_butcher', 'player1', 'board', { instanceId: 'tab1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['tab1'] },
    });

    // Should present choose_mode with Pay 0 through Pay 3, plus Pass
    expect(attackResult.waitingFor?.type).toBe('choose_mode');
    const choice = attackResult.state.pendingChoice!;
    if (choice.type === 'choose_mode') {
      expect(choice.modes).toHaveLength(5); // Pay 0, 1, 2, 3, Pass
    }
  });

  it('pay 0 deals 1 wound to chosen follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .withStanding('player1', 'void', 3)
      .addCard('the_ancient_butcher', 'player1', 'board', { instanceId: 'tab1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['tab1'] },
    });

    // Pay 0 → deal 1 wound
    const payResult = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // Should ask for target
    expect(payResult.waitingFor?.type).toBe('choose_target');

    const targetResult = processAction(payResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    expectPlayerMythium(targetResult.state, 'player1', 3); // No mythium spent
    expectCardCounter(targetResult.state, 'sb1', 'wound', 1);
  });

  it('pay 3 deals 4 wounds and deducts mythium, defeating the target', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .withStanding('player1', 'void', 3)
      .addCard('the_ancient_butcher', 'player1', 'board', { instanceId: 'tab1' })
      .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'eg1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['tab1'] },
    });

    // Pay 3 → deal 4 wounds (modeIndex 3)
    const payResult = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 3 },
    });

    const targetResult = processAction(payResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'eg1' },
    });

    expectPlayerMythium(targetResult.state, 'player1', 0);
    // Earthshaker giant (4 health) takes 4 wounds → defeated
    const eg = targetResult.state.cards.find(c => c.instanceId === 'eg1')!;
    expect(eg.zone).toBe('discard');
  });

  it('can pass without paying', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .withStanding('player1', 'void', 3)
      .addCard('the_ancient_butcher', 'player1', 'board', { instanceId: 'tab1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['tab1'] },
    });

    // Choose Pass (last mode)
    const passResult = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 4 },
    });

    // Should proceed to blockers, no wounds dealt
    expect(passResult.waitingFor?.type).toBe('choose_blockers');
    expectPlayerMythium(passResult.state, 'player1', 3);
    const sb = passResult.state.cards.find(c => c.instanceId === 'sb1')!;
    expect(sb.counters.wound).toBeUndefined();
  });

  it('does not trigger when attacking with multiple followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('the_ancient_butcher', 'player1', 'board', { instanceId: 'tab1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['tab1', 'ms1'] },
    });

    // Should go straight to blockers — no pay X choice
    expect(attackResult.waitingFor?.type).toBe('choose_blockers');
  });

  it('does not trigger when no opponent followers to target', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('the_ancient_butcher', 'player1', 'board', { instanceId: 'tab1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['tab1'] },
    });

    // No opponent followers — should skip to blockers
    expect(attackResult.waitingFor?.type).toBe('choose_blockers');
  });
});
