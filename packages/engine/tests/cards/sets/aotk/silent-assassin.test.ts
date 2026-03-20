import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { autoAccept } from '../../../helpers/game';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Silent Assassin', () => {
  hasPlayCost('silent_assassin', 3, { void: 1 });

  it('bloodshed 1 deals 1 wound to chosen defender follower when attacking alone', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'void', 1)
      .addCard('silent_assassin', 'player1', 'board', { instanceId: 'sa1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['sa1'] },
    }));

    // Should be waiting for bloodshed target choice
    expect(attackResult.waitingFor?.type).toBe('choose_target');

    const chooseResult = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    // Shield bearer should have 1 wound from bloodshed
    const sb = chooseResult.state.cards.find(c => c.instanceId === 'sb1')!;
    expect(sb.counters.wound).toBe(1);
  });

  it('bloodshed does not trigger when attacking with multiple followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'void', 1)
      .addCard('silent_assassin', 'player1', 'board', { instanceId: 'sa1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    let result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['sa1', 'ms1'] },
    });

    // Non-forced trigger still presents choice; resolve it (no-op due to attacking_alone)
    while (result.state.pendingChoice?.type === 'choose_trigger_order') {
      result = autoAccept(result);
    }

    // Should reach blockers, no bloodshed target choice
    expect(result.waitingFor?.type).toBe('choose_blockers');
  });
});
