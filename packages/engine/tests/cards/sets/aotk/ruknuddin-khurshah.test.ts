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

describe('Ruknuddin Khurshah, Leader of the Order', () => {
  it('deals 1 wound to an opponent follower during attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('ruknuddin_khurshah_leader_of_the_order', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'def1' }) // 1/3
      .build();

    // Attack triggers your_attack — Ruknuddin's ability is optional
    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // Accept the trigger
    const triggerResult = autoAccept(attackResult);

    // Choose target for the wound
    const result = processAction(triggerResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'def1' },
    });

    // Shield bearer should have 1 wound
    expectCardCounter(result.state, 'def1', 'wound', 1);

    // 1 mythium should have been spent
    expectPlayerMythium(result.state, 'player1', 2);

    // Worldbreaker should be exhausted
    const wb = result.state.cards.find(c => c.instanceId === 'wb1');
    expect(wb!.exhausted).toBe(true);
  });

  it('does not offer trigger when worldbreaker is already exhausted', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('ruknuddin_khurshah_leader_of_the_order', 'player1', 'worldbreaker', { instanceId: 'wb1', exhausted: true })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'def1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // Should go straight to blockers — no trigger offered
    expect(result.waitingFor?.type).toBe('choose_blockers');
  });

  it('does not offer trigger when player has 0 mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('ruknuddin_khurshah_leader_of_the_order', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'def1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // Should go straight to blockers — no trigger offered
    expect(result.waitingFor?.type).toBe('choose_blockers');
  });

  it('can be skipped as an optional trigger', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('ruknuddin_khurshah_leader_of_the_order', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'def1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // Skip the trigger
    const result = processAction(attackResult.state, {
      player: 'player1',
      action: { type: 'skip_trigger', triggerIndex: 0 },
    });

    // Mythium unchanged
    expectPlayerMythium(result.state, 'player1', 3);

    // Worldbreaker should not be exhausted
    const wb = result.state.cards.find(c => c.instanceId === 'wb1');
    expect(wb!.exhausted).toBe(false);
  });
});
