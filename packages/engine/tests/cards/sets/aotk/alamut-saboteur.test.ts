import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone, expectHandSize, expectPlayerPower } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Alamut Saboteur', () => {
  hasPlayCost('alamut_saboteur', 3, { void: 2 });

  it('breach: defending player must discard a card', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('alamut_saboteur', 'player1', 'board', { instanceId: 'as1' })
      .addCard('militia_scout', 'player2', 'hand', { instanceId: 'ms1' })
      .build();

    // Attack with the saboteur, opponent passes block
    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['as1'] },
    });

    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // Breach triggers — defending player should have a pending discard choice
    expect(passResult.state.pendingChoice).not.toBeNull();
    expect(passResult.state.pendingChoice!.type).toBe('choose_discard');

    // Defender discards their card
    const discardResult = processAction(passResult.state, {
      player: 'player2',
      action: { type: 'choose_discard', cardInstanceIds: ['ms1'] },
    });

    expectCardInZone(discardResult.state, 'ms1', 'discard');
    expectHandSize(discardResult.state, 'player2', 0);
  });

  it('breach: no discard when defending player has empty hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('alamut_saboteur', 'player1', 'board', { instanceId: 'as1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['as1'] },
    });

    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // No discard pending since defender has empty hand
    // Breach power is gained (1 attacker = 1 power)
    expectPlayerPower(passResult.state, 'player1', 1);
  });

  it('breach with defender locations: after discard, choose_breach_target appears', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('alamut_saboteur', 'player1', 'board', { instanceId: 'as1' })
      .addCard('militia_scout', 'player2', 'hand', { instanceId: 'ms1' })
      .addCard('the_den_of_sabers', 'player2', 'board', { instanceId: 'loc1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['as1'] },
    });

    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // Breach triggers discard first
    expect(passResult.state.pendingChoice).not.toBeNull();
    expect(passResult.state.pendingChoice!.type).toBe('choose_discard');

    // Defender discards
    const discardResult = processAction(passResult.state, {
      player: 'player2',
      action: { type: 'choose_discard', cardInstanceIds: ['ms1'] },
    });

    // After discard, breach resumes — attacker gets breach target choice
    expect(discardResult.state.pendingChoice).not.toBeNull();
    expect(discardResult.state.pendingChoice!.type).toBe('choose_breach_target');

    // Attacker gained breach power
    expectPlayerPower(discardResult.state, 'player1', 1);
  });

  it('breach: attacker gains power from breach', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('alamut_saboteur', 'player1', 'board', { instanceId: 'as1' })
      .addCard('militia_scout', 'player2', 'hand', { instanceId: 'ms1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['as1'] },
    });

    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    const discardResult = processAction(passResult.state, {
      player: 'player2',
      action: { type: 'choose_discard', cardInstanceIds: ['ms1'] },
    });

    // Breach power: 1 attacker = 1 power
    expectPlayerPower(discardResult.state, 'player1', 1);
  });
});
