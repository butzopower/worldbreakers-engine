import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectPlayerPower } from '../../../helpers/assertions';
import { autoAccept } from '../../../helpers/game';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

function acceptOptionalAttack(result: ReturnType<typeof processAction>) {
  expect(result.waitingFor?.type).toBe('choose_mode');
  return processAction(result.state, {
    player: 'player1',
    action: { type: 'choose_mode', modeIndex: 0 },
  });
}

function declineOptionalAttack(result: ReturnType<typeof processAction>) {
  expect(result.waitingFor?.type).toBe('choose_mode');
  return processAction(result.state, {
    player: 'player1',
    action: { type: 'choose_mode', modeIndex: 1 }, // Pass
  });
}

describe('Swirling Skirmisher', () => {
  hasPlayCost('swirling_skirmisher', 2, { void: 3 });

  it('enters and offers optional first attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('swirling_skirmisher', 'player1', 'hand', { instanceId: 'ss1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const result = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ss1' },
    }));

    // Optional attack prompt
    expect(result.waitingFor?.type).toBe('choose_mode');
  });

  it('both attacks can be taken for two breaches', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('swirling_skirmisher', 'player1', 'hand', { instanceId: 'ss1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms2' })
      .build();

    const playResult = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ss1' },
    }));

    // Accept first attack
    const opt1 = acceptOptionalAttack(playResult);
    expect(opt1.waitingFor?.type).toBe('choose_attackers');

    const attack1 = processAction(opt1.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });
    const pass1 = processAction(attack1.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // Accept second attack
    const opt2 = acceptOptionalAttack(pass1);
    expect(opt2.waitingFor?.type).toBe('choose_attackers');

    const attack2 = processAction(opt2.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms2'] },
    });
    const pass2 = processAction(attack2.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    expectPlayerPower(pass2.state, 'player1', 2);
  });

  it('first attack can be declined', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('swirling_skirmisher', 'player1', 'hand', { instanceId: 'ss1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ss1' },
    }));

    // Decline first attack — should still offer second
    const decline1 = declineOptionalAttack(playResult);

    // Second attack prompt
    expect(decline1.waitingFor?.type).toBe('choose_mode');
  });

  it('both attacks can be declined', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('swirling_skirmisher', 'player1', 'hand', { instanceId: 'ss1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ss1' },
    }));

    const decline1 = declineOptionalAttack(playResult);
    const decline2 = declineOptionalAttack(decline1);

    // Turn should advance
    expect(decline2.state.activePlayer).toBe('player2');
    expectPlayerPower(decline2.state, 'player1', 0);
  });
});
