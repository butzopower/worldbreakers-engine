import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectCardCounter } from '../../../helpers/assertions.js';
import { autoAccept } from '../../../helpers/game';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Right Hand', () => {
  it('does not offer trigger when player has 0 mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('ruknuddin_khurshah_leader_of_the_order', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('the_right_hand', 'player1', 'board', { instanceId: 'trh1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'def1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // Neither trigger should be offered (both cost mythium, player has 0)
    expect(result.waitingFor?.type).toBe('choose_blockers');
  });

  it('works with Ruknuddin to deal 2 wounds when activated first', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('ruknuddin_khurshah_leader_of_the_order', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('the_right_hand', 'player1', 'board', { instanceId: 'trh1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'def1' }) // 1/3
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // Two your_attack triggers → choose order
    expect(attackResult.waitingFor?.type).toBe('choose_trigger_order');

    // Activate The Right Hand first to grant the boost
    const triggers = (attackResult.state.pendingChoice as { triggers: Array<{ sourceCardId: string }> }).triggers;
    const trhIndex = triggers.findIndex(t => t.sourceCardId === 'trh1');

    const trhResult = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'choose_trigger', triggerIndex: trhIndex },
    });

    // Now Ruknuddin's trigger should auto-resolve (only one left)
    // Accept the remaining trigger
    const wbResult = autoAccept(trhResult);

    // Choose target for Ruknuddin's wound
    const result = processAction(wbResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'def1' },
    });

    // Shield bearer should have 2 wounds (1 base + 1 boost from The Right Hand)
    expectCardCounter(result.state, 'def1', 'wound', 2);

    // 2 mythium spent total (1 for The Right Hand + 1 for Ruknuddin)
    expectPlayerMythium(result.state, 'player1', 3);
  });
});
