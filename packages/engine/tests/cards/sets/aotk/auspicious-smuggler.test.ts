import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { hasPlayCost } from '../../../helpers/properties';
import { autoAccept } from '../../../helpers/game';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Auspicious Smuggler', () => {
  hasPlayCost('auspicious_smuggler', 3, { stars: 2 });

  it('grants a pending bonus action on enter', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 2)
      .withMythium('player1', 5)
      .addCard('auspicious_smuggler', 'player1', 'hand', { instanceId: 'as1' })
      .build();

    const result = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'as1' },
    }));

    // After playing, turn advances to player2 — pending converted when switching back
    expect(result.state.activePlayer).toBe('player2');
  });

  it('player gets two consecutive actions on their next turn', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 2)
      .withMythium('player1', 10)
      .withMythium('player2', 10)
      .addCard('auspicious_smuggler', 'player1', 'hand', { instanceId: 'as1' })
      .build();

    // Player 1 plays smuggler (action 1)
    const playResult = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'as1' },
    }));
    expect(playResult.state.activePlayer).toBe('player2');

    // Player 2 takes an action (action 2) — pending bonus converts when switching back to p1
    const p2Result = processAction(playResult.state, {
      player: 'player2',
      action: { type: 'gain_mythium' },
    });
    expect(p2Result.state.activePlayer).toBe('player1');
    expect(p2Result.state.players.player1.bonusActions).toBe(1);

    // Player 1 takes first action (action 3)
    const p1FirstAction = processAction(p2Result.state, {
      player: 'player1',
      action: { type: 'gain_mythium' },
    });
    // Bonus action consumed — player stays active
    expect(p1FirstAction.state.activePlayer).toBe('player1');
    expect(p1FirstAction.state.players.player1.bonusActions).toBe(0);

    // Player 1 takes second action (action 4) — now switches normally
    const p1SecondAction = processAction(p1FirstAction.state, {
      player: 'player1',
      action: { type: 'gain_mythium' },
    });
    expect(p1SecondAction.state.activePlayer).toBe('player2');
  });

  it('bonus action does not count toward the round action limit', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 2)
      .withMythium('player1', 10)
      .withMythium('player2', 10)
      .addCard('auspicious_smuggler', 'player1', 'hand', { instanceId: 'as1' })
      .build();

    // Player 1 plays smuggler (action 1)
    const playResult = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'as1' },
    }));

    // Player 2 takes action (action 2)
    const p2Result = processAction(playResult.state, {
      player: 'player2',
      action: { type: 'gain_mythium' },
    });

    // Player 1 takes bonus action (does not increment actionsTaken)
    const bonusAction = processAction(p2Result.state, {
      player: 'player1',
      action: { type: 'gain_mythium' },
    });
    // actionsTaken should be 2 (play + p2 action), not 3
    expect(bonusAction.state.actionsTaken).toBe(2);

    // Player 1 takes normal action
    const normalAction = processAction(bonusAction.state, {
      player: 'player1',
      action: { type: 'gain_mythium' },
    });
    expect(normalAction.state.actionsTaken).toBe(3);
  });

  it('bonus action does not carry over to the next round', () => {
    // Set up near end of round so we can trigger rally
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 2)
      .withMythium('player1', 10)
      .withMythium('player2', 10)
      .addCard('auspicious_smuggler', 'player1', 'hand', { instanceId: 'as1' })
      .build();

    // Simulate being at action 7 (last action of round)
    const lateState = { ...state, actionsTaken: 7 };

    // Player 1 plays smuggler on last action — rally triggers
    const playResult = autoAccept(processAction(lateState, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'as1' },
    }));

    // After rally, bonus actions should be reset
    expect(playResult.state.players.player1.bonusActions).toBe(0);
    expect(playResult.state.players.player1.pendingBonusActions).toBe(0);
    expect(playResult.state.round).toBe(2);
  });
});
