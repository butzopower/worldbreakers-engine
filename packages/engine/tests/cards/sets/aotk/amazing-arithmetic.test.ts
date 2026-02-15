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

describe('Amazing Arithmetic', () => {
  it('costs 0 and requires void: 1 standing', () => {
    // Without void standing, cannot play
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('amazing_arithmetic', 'player1', 'hand', { instanceId: 'aa1' })
      .build();

    const legalActions = getLegalActions(state);
    const playActions = legalActions.filter(
      a => a.action.type === 'play_card' && a.action.cardInstanceId === 'aa1',
    );
    expect(playActions).toHaveLength(0);
  });

  it('can be played with void: 1 standing at cost 0', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .withStanding('player1', 'void', 1)
      .addCard('amazing_arithmetic', 'player1', 'hand', { instanceId: 'aa1' })
      .build();

    const legalActions = getLegalActions(state);
    const playActions = legalActions.filter(
      a => a.action.type === 'play_card' && a.action.cardInstanceId === 'aa1',
    );
    expect(playActions).toHaveLength(1);
  });

  it('gains 2 mythium on play, then presents choose_mode (attack or pass)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .withStanding('player1', 'void', 1)
      .addCard('amazing_arithmetic', 'player1', 'hand', { instanceId: 'aa1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'aa1' },
    });

    // Gained 2 mythium (3 + 2 = 5)
    expectPlayerMythium(result.state, 'player1', 5);
    // Event goes to discard
    expectCardInZone(result.state, 'aa1', 'discard');
    // Pending choose_mode with Attack/Pass
    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_mode');
    if (result.state.pendingChoice!.type === 'choose_mode') {
      expect(result.state.pendingChoice!.modes).toHaveLength(2);
      expect(result.state.pendingChoice!.modes[0].label).toBe('Attack');
      expect(result.state.pendingChoice!.modes[1].label).toBe('Pass');
    }
  });

  it('choosing "Pass" ends the event and advances turn', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .withStanding('player1', 'void', 1)
      .addCard('amazing_arithmetic', 'player1', 'hand', { instanceId: 'aa1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'aa1' },
    });

    // Choose Pass (mode index 1)
    const passResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    expect(passResult.state.pendingChoice).toBeNull();
    expect(passResult.state.combat).toBeNull();
    expect(passResult.state.activePlayer).toBe('player2');
    expect(passResult.state.actionsTaken).toBe(1);
  });

  it('choosing "Attack" presents choose_attackers with valid followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .withStanding('player1', 'void', 1)
      .addCard('amazing_arithmetic', 'player1', 'hand', { instanceId: 'aa1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'aa1' },
    });

    // Choose Attack (mode index 0)
    const attackResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(attackResult.state.pendingChoice).not.toBeNull();
    expect(attackResult.state.pendingChoice!.type).toBe('choose_attackers');
    if (attackResult.state.pendingChoice!.type === 'choose_attackers') {
      expect(attackResult.state.pendingChoice!.playerId).toBe('player1');
    }

    // Legal actions should include choose_attackers
    const legalActions = getLegalActions(attackResult.state);
    expect(legalActions.length).toBeGreaterThan(0);
    expect(legalActions.every(a => a.action.type === 'choose_attackers')).toBe(true);
  });

  it('full attack flow: play event → gain mythium → choose attack → choose attackers → combat', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .withStanding('player1', 'void', 1)
      .addCard('amazing_arithmetic', 'player1', 'hand', { instanceId: 'aa1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    // Play the event
    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'aa1' },
    });
    expectPlayerMythium(playResult.state, 'player1', 2);

    // Choose Attack
    const attackChoice = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });
    expect(attackChoice.state.pendingChoice!.type).toBe('choose_attackers');

    // Choose militia_scout as attacker
    const attackerChoice = processAction(attackChoice.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });

    // Combat should now be active
    expect(attackerChoice.state.combat).not.toBeNull();
    expect(attackerChoice.state.combat!.attackingPlayer).toBe('player1');
    expect(attackerChoice.state.combat!.attackerIds).toEqual(['ms1']);
    expect(attackerChoice.state.combat!.step).toBe('declare_blockers');

    // Defender passes block → breach
    const passResult = processAction(attackerChoice.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // Should be in breach step or ended
    if (passResult.state.combat) {
      expect(passResult.state.combat.step).toBe('breach');

      // Skip breach damage
      const skipResult = processAction(passResult.state, {
        player: 'player1',
        action: { type: 'skip_breach_damage' },
      });
      expect(skipResult.state.combat).toBeNull();
      expect(skipResult.state.activePlayer).toBe('player2');
    } else {
      // Combat ended, turn advanced
      expect(passResult.state.activePlayer).toBe('player2');
    }
  });

  it('choosing "Attack" with no attackable followers is a no-op, turn advances', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .withStanding('player1', 'void', 1)
      .addCard('amazing_arithmetic', 'player1', 'hand', { instanceId: 'aa1' })
      // No followers on board
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'aa1' },
    });

    // Choose Attack (mode index 0) - but no followers
    const attackResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // initiate_attack finds no attackable followers → no-op → turn advances
    expect(attackResult.state.pendingChoice).toBeNull();
    expect(attackResult.state.combat).toBeNull();
    expect(attackResult.state.activePlayer).toBe('player2');
    expect(attackResult.state.actionsTaken).toBe(1);
  });

  it('exhausted followers cannot be chosen as attackers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .withStanding('player1', 'void', 1)
      .addCard('amazing_arithmetic', 'player1', 'hand', { instanceId: 'aa1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1', exhausted: true })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'aa1' },
    });

    // Choose Attack - but the only follower is exhausted
    const attackResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // No attackable followers → no-op → turn advances
    expect(attackResult.state.pendingChoice).toBeNull();
    expect(attackResult.state.combat).toBeNull();
    expect(attackResult.state.activePlayer).toBe('player2');
  });

  it('validates that choose_attackers rejects invalid attacker ids', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .withStanding('player1', 'void', 1)
      .addCard('amazing_arithmetic', 'player1', 'hand', { instanceId: 'aa1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms2' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'aa1' },
    });

    const attackChoice = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // Try to attack with opponent's follower
    expect(() => processAction(attackChoice.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms2'] },
    })).toThrow('Invalid action');
  });
});
