import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

function acceptBlocksTrigger(result: ReturnType<typeof processAction>) {
  expect(result.waitingFor?.type).toBe('choose_trigger_order');
  return processAction(result.state, {
    player: 'player2',
    action: { type: 'choose_trigger', triggerIndex: 0 },
  });
}

describe('Sly Sentinel', () => {
  hasPlayCost('sly_sentinel', 3, { stars: 1 });

  it('removes another attacker from combat when blocking', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms2' })
      .addCard('sly_sentinel', 'player2', 'board', { instanceId: 'ss1' })
      .build();

    // Player 1 attacks with both scouts
    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ms1', 'ms2'] },
    });

    expect(attackResult.waitingFor?.type).toBe('choose_blockers');

    // Player 2 blocks ms1 with sentinel — blocks trigger fires
    const blockResult = acceptBlocksTrigger(processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ss1', attackerId: 'ms1' },
    }));

    // Should prompt to choose which other attacker to remove (only ms2)
    expect(blockResult.waitingFor?.type).toBe('choose_target');

    // Choose to remove ms2 from combat
    const removeResult = processAction(blockResult.state, {
      player: 'player2',
      action: { type: 'choose_target', targetInstanceId: 'ms2' },
    });

    // ms2 was removed from combat, ms1 was blocked — no breach
    expect(removeResult.state.players.player1.power).toBe(0);
  });

  it('does not trigger when there are no other attackers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('sly_sentinel', 'player2', 'board', { instanceId: 'ss1' })
      .build();

    // Player 1 attacks with only one scout
    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ms1'] },
    });

    // Block with sentinel
    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ss1', attackerId: 'ms1' },
    });

    // Trigger prompts but custom resolve finds no other attackers — should skip
    // The non-forced trigger still presents choose_trigger_order
    expect(blockResult.waitingFor?.type).toBe('choose_trigger_order');

    // Accept the trigger — but it should have no targets and resolve with no effect
    const acceptResult = processAction(blockResult.state, {
      player: 'player2',
      action: { type: 'choose_trigger', triggerIndex: 0 },
    });

    // No choose_target prompt since there are no other attackers
    expect(acceptResult.state.pendingChoice?.type).not.toBe('choose_target');
  });

  it('blocks trigger can be skipped', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms2' })
      .addCard('sly_sentinel', 'player2', 'board', { instanceId: 'ss1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ms1', 'ms2'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ss1', attackerId: 'ms1' },
    });

    expect(blockResult.waitingFor?.type).toBe('choose_trigger_order');

    // Skip the trigger
    const skipResult = processAction(blockResult.state, {
      player: 'player2',
      action: { type: 'skip_trigger', triggerIndex: 0 },
    });

    // ms2 was not removed — it breaches for power
    expect(skipResult.state.players.player1.power).toBe(1);
  });
});
