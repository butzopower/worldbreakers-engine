import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectCardCounter, expectPlayerPower } from '../../../helpers/assertions';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Consumed by the Dust', () => {
  hasPlayCost('consumed_by_the_dust', 2, { void: 2 });

  it('playing initiates an attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 2)
      .addCard('consumed_by_the_dust', 'player1', 'hand', { instanceId: 'cbtd1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'cbtd1' },
    });

    expect(result.waitingFor?.type).toBe('choose_attackers');
  });

  it('on successful breach, damages a location and optionally a second', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 2)
      .addCard('consumed_by_the_dust', 'player1', 'hand', { instanceId: 'cbtd1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .build();

    // Play event
    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'cbtd1' },
    });

    // Choose attacker
    const attackResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });

    // No blockers
    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // Regular breach target — damage watchtower (3 → 2)
    expect(passResult.waitingFor?.type).toBe('choose_breach_target');
    const breachResult = processAction(passResult.state, {
      player: 'player1',
      action: { type: 'damage_location', locationInstanceId: 'wt1' },
    });

    // Optional first damage
    expect(breachResult.waitingFor?.type).toBe('choose_mode');
    const optDamage = processAction(breachResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 }, // Choose "Damage a location again"
    });

    // On-breach response: damage a location (2 → 1)
    expect(optDamage.waitingFor?.type).toBe('choose_breach_target');
    const damage1 = processAction(optDamage.state, {
      player: 'player1',
      action: { type: 'damage_location', locationInstanceId: 'wt1' },
    });

    // Optional second damage
    expect(damage1.waitingFor?.type).toBe('choose_mode');
    const optDamageAgain = processAction(damage1.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 }, // Choose "Damage a location again"
    });

    // Third damage target (1 → 0, depleted)
    expect(optDamageAgain.waitingFor?.type).toBe('choose_breach_target');
    const damage2 = processAction(optDamageAgain.state, {
      player: 'player1',
      action: { type: 'damage_location', locationInstanceId: 'wt1' },
    });

    // Watchtower should be depleted (moved to discard)
    const wt = damage2.state.cards.find(c => c.instanceId === 'wt1')!;
    expect(wt.zone).toBe('discard');
  });

  it('on_breach response does not fire if attack is blocked (no breach)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 2)
      .addCard('consumed_by_the_dust', 'player1', 'hand', { instanceId: 'cbtd1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'eg1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'cbtd1' },
    });
    const attackResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });

    // Block with earthshaker giant — kills militia scout, no breach
    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'eg1', attackerId: 'ms1' },
    });

    // Watchtower should still have all 3 stages — no breach, no damage
    expectCardCounter(blockResult.state, 'wt1', 'stage', 3);
  });

  it('does nothing if no followers can attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 2)
      .addCard('consumed_by_the_dust', 'player1', 'hand', { instanceId: 'cbtd1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'cbtd1' },
    });

    // No attackable followers — turn should advance
    expect(result.state.activePlayer).toBe('player2');
  });
});
