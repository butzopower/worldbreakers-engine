import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';
import { getCounter } from '../../../../src/types/counters.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Alamut Emissary', () => {
  hasPlayCost('alamut_emissary', 4, { void: 2 });

  it('bloodshed 1 deals 1 wound to a chosen defender follower when attacking alone', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('alamut_emissary', 'player1', 'board', { instanceId: 'ae1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ae1'] },
    });

    // Should be waiting for bloodshed target choice
    expect(attackResult.waitingFor?.type).toBe('choose_target');

    const chooseResult = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    // Shield bearer should have 1 wound from bloodshed
    const sb = chooseResult.state.cards.find(c => c.instanceId === 'sb1')!;
    expect(getCounter(sb.counters, 'wound')).toBe(1);
  });

  it('bloodshed does not trigger when attacking with multiple followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('alamut_emissary', 'player1', 'board', { instanceId: 'ae1' })
      .addCard('alamut_emissary', 'player1', 'board', { instanceId: 'ae2' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    let result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ae1', 'ae2'] },
    });

    // Multiple attacks triggers require ordering; resolve them (both are no-ops due to attacking_alone)
    while (result.waitingFor?.type === 'choose_trigger_order') {
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });
    }

    // Should reach blockers, no bloodshed target choice
    expect(result.waitingFor?.type).toBe('choose_blockers');

    // Shield bearer should have no wounds
    const sb = result.state.cards.find(c => c.instanceId === 'sb1')!;
    expect(getCounter(sb.counters, 'wound')).toBe(0);
  });
});
