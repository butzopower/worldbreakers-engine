import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone } from '../../../helpers/assertions.js';
import { goToNextRound } from '../../../helpers/game.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe("Polo's Portraitist", () => {
  it('prevents both players from attacking for the remainder of the round', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'stars', 2)
      .addCard('polos_portraitist', 'player1', 'hand', { instanceId: 'pp1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'atk2' })
      .build();

    // Play Polo's Portraitist — enters ability is forced, so it auto-resolves
    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pp1' },
    });

    expectCardInZone(result.state, 'pp1', 'board');

    // Turn advances to player2 — they should not be able to attack
    const p2Actions = getLegalActions(result.state);
    const p2AttackActions = p2Actions.filter(a => a.action.type === 'attack');
    expect(p2AttackActions).toHaveLength(0);

    // Player2 passes, back to player1 — player1 also can't attack
    const passResult = processAction(result.state, {
      player: 'player2',
      action: { type: 'gain_mythium' },
    });

    const p1Actions = getLegalActions(passResult.state);
    const p1AttackActions = p1Actions.filter(a => a.action.type === 'attack');
    expect(p1AttackActions).toHaveLength(0);
  });

  it('allows attacks again in the next round', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withMythium('player2', 10)
      .withStanding('player1', 'stars', 2)
      .addCard('polos_portraitist', 'player1', 'hand', { instanceId: 'pp1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'atk2' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'd1' })
      .addCard('militia_scout', 'player2', 'deck', { instanceId: 'd2' })
      .build();

    // Play Polo's Portraitist — no attacks for remainder of round
    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pp1' },
    });

    const nextRound = goToNextRound(playResult);

    // After rally, we're in a new round — attacks should be allowed again
    expect(nextRound.state.round).toBe(2);
    const newRoundActions = getLegalActions(nextRound.state);
    const attackActions = newRoundActions.filter(a => a.action.type === 'attack');
    expect(attackActions.length).toBeGreaterThan(0);
  });
});
