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

describe('Suave Sycophant', () => {
  hasPlayCost('suave_sycophant', 3, { stars: 2 });

  it('puts a stationary counter on the attacker it blocks', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 2)
      .withMythium('player1', 10)
      .addCard('earthshaker_giant', 'player1', 'board', { instanceId: 'eg1' })
      .addCard('suave_sycophant', 'player2', 'board', { instanceId: 'ss1' })
      .build();

    // Player 1 attacks with earthshaker giant (3/4 — survives combat with sycophant 1/4)
    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['eg1'] },
    });

    expect(attackResult.waitingFor?.type).toBe('choose_blockers');

    // Player 2 blocks with sycophant — triggers blocks ability
    const blockResult = acceptBlocksTrigger(processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ss1', attackerId: 'eg1' },
    }));

    // Attacker should have a stationary counter
    const giant = blockResult.state.cards.find(c => c.instanceId === 'eg1')!;
    expect(giant.counters.stationary).toBe(1);
    expect(giant.zone).toBe('board');
  });

  it('blocks trigger can be skipped', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 2)
      .withMythium('player1', 10)
      .addCard('earthshaker_giant', 'player1', 'board', { instanceId: 'eg1' })
      .addCard('suave_sycophant', 'player2', 'board', { instanceId: 'ss1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['eg1'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ss1', attackerId: 'eg1' },
    });

    // Non-forced trigger — can be skipped
    expect(blockResult.waitingFor?.type).toBe('choose_trigger_order');

    const skipResult = processAction(blockResult.state, {
      player: 'player2',
      action: { type: 'skip_trigger', triggerIndex: 0 },
    });

    // Bearer should NOT have stationary counter
    const giant = skipResult.state.cards.find(c => c.instanceId === 'eg1')!;
    expect(giant.counters.stationary).toBeUndefined();
  });
});
