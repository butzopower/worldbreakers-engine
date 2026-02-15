import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerPower } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Alert Warden', () => {
  hasPlayCost('alert_warden', 3, { moon: 1 });

  it('cannot attack when controller has less than 4 moon standing (stationary applies)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'moon', 3)
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('alert_warden', 'player1', 'board', { instanceId: 'aw1' })
      .build();

    expect(() => processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['aw1'] },
    })).toThrow('Invalid action');
  });

  it('can attack when controller has 4 or more moon standing (stationary removed)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'moon', 4)
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('alert_warden', 'player1', 'board', { instanceId: 'aw1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['aw1'] },
    });

    // Attack should succeed — combat state should be active
    expect(result.state.combat).not.toBeNull();
    expect(result.state.combat!.attackerIds).toContain('aw1');
  });

  it('can always block regardless of moon standing', () => {
    const state = buildState()
      .withActivePlayer('player2')
      .withStanding('player1', 'moon', 1)
      .addCard('stone_sentinel', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .addCard('alert_warden', 'player1', 'board', { instanceId: 'aw1' })
      .build();

    // Player 2 attacks with militia_scout
    const attackResult = processAction(state, {
      player: 'player2',
      action: { type: 'attack', attackerIds: ['ms1'] },
    });

    // Player 1 blocks with Alert Warden (even with low moon standing)
    const blockResult = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'declare_blocker', blockerId: 'aw1', attackerId: 'ms1' },
    });

    // Block should succeed — fight resolved
    expect(blockResult.events.some(e => e.type === 'fight_resolved')).toBe(true);
  });

  it('gains breach power when attacking with sufficient standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'moon', 5)
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('alert_warden', 'player1', 'board', { instanceId: 'aw1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['aw1'] },
    });

    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    expectPlayerPower(passResult.state, 'player1', 1);
  });
});
