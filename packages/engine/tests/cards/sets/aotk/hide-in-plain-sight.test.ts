import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction, getLegalActions } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectCardInZone, expectPlayerPower } from '../../../helpers/assertions';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Hide in Plain Sight', () => {
  hasPlayCost('hide_in_plain_sight', 2, { void: 3 });

  it('chosen follower cannot be blocked and breaches', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('hide_in_plain_sight', 'player1', 'hand', { instanceId: 'hips1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'scout1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blocker1' })
      .build();

    // Play the event — first prompts to choose target for unblockable
    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'hips1' },
    });

    expect(playResult.state.pendingChoice?.type).toBe('choose_target');

    // Choose scout to gain unblockable
    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'scout1' },
    });

    expect(chooseResult.state.pendingChoice?.type).toBe('choose_attackers');

    // Attack with the scout
    const attackResult = processAction(chooseResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['scout1'] },
    });

    // Defender cannot block — no declare_blocker actions available
    const legalActions = getLegalActions(attackResult.state);
    const blockActions = legalActions.filter(a => a.action.type === 'declare_blocker');
    expect(blockActions).toHaveLength(0);

    // Pass block — scout breaches
    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    expectPlayerPower(passResult.state, 'player1', 1);
  });

  it('limits attack to one follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('hide_in_plain_sight', 'player1', 'hand', { instanceId: 'hips1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'scout1' })
      .addCard('shield_bearer', 'player1', 'board', { instanceId: 'sb1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'hips1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'scout1' },
    });

    // Should only offer individual attacker options, not "all attackers"
    const legalActions = getLegalActions(chooseResult.state);
    const attackActions = legalActions.filter(a => a.action.type === 'choose_attackers');
    for (const action of attackActions) {
      if (action.action.type === 'choose_attackers') {
        expect(action.action.attackerIds.length).toBe(1);
      }
    }

    // Trying to attack with both should fail
    expect(() => processAction(chooseResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['scout1', 'sb1'] },
    })).toThrow('Invalid action');
  });

  it('unblockable expires after combat', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('hide_in_plain_sight', 'player1', 'hand', { instanceId: 'hips1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'scout1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'hips1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'scout1' },
    });

    const attackResult = processAction(chooseResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['scout1'] },
    });

    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    const unblockableEffects = passResult.state.lastingEffects.filter(e => e.type === 'unblockable');
    expect(unblockableEffects).toHaveLength(0);
  });

  it('event goes to discard after playing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('hide_in_plain_sight', 'player1', 'hand', { instanceId: 'hips1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'scout1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'hips1' },
    });

    expectCardInZone(playResult.state, 'hips1', 'discard');
  });
});
