import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectCardInZone } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Dogtamer', () => {
  it('costs 1 and requires earth: 1 standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      // No earth standing
      .addCard('dogtamer', 'player1', 'hand', { instanceId: 'dt1' })
      .build();

    const legalActions = getLegalActions(state);
    const playActions = legalActions.filter(
      a => a.action.type === 'play_card' && a.action.cardInstanceId === 'dt1',
    );
    expect(playActions).toHaveLength(0);
  });

  it('can be played with earth: 1 standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 1)
      .addCard('dogtamer', 'player1', 'hand', { instanceId: 'dt1' })
      .build();

    const legalActions = getLegalActions(state);
    const playActions = legalActions.filter(
      a => a.action.type === 'play_card' && a.action.cardInstanceId === 'dt1',
    );
    expect(playActions).toHaveLength(1);
  });

  it('presents choose_mode with both options when player has earth standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('dogtamer', 'player1', 'hand', { instanceId: 'dt1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'dt1' },
    });

    expectCardInZone(result.state, 'dt1', 'board');
    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_mode');
    if (result.state.pendingChoice!.type === 'choose_mode') {
      expect(result.state.pendingChoice!.modes).toHaveLength(2);
      expect(result.state.pendingChoice!.modes[0].label).toBe('Gain 1 Earth standing');
      expect(result.state.pendingChoice!.modes[1].label).toBe('Migrate');
    }
  });

  it('choosing "Gain 1 Earth standing" increases earth standing by 1', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('dogtamer', 'player1', 'hand', { instanceId: 'dt1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'dt1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(chooseResult.state.players.player1.standing.earth).toBe(3);
    // No mythium gained from migrate effect
    expectPlayerMythium(chooseResult.state, 'player1', 4); // 5 - 1 cost
    expect(chooseResult.state.pendingChoice).toBeNull();
    expect(chooseResult.state.activePlayer).toBe('player2');
  });

  it('choosing "Migrate" loses 1 earth standing and gains 3 mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('dogtamer', 'player1', 'hand', { instanceId: 'dt1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'dt1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    // Earth standing: 2 - 1 = 1
    expect(chooseResult.state.players.player1.standing.earth).toBe(1);
    // Mythium: 5 - 1 (cost) + 3 (migrate effect) = 7
    expectPlayerMythium(chooseResult.state, 'player1', 7);
    expect(chooseResult.state.pendingChoice).toBeNull();
    expect(chooseResult.state.activePlayer).toBe('player2');
  });

  it('choosing "Migrate" with exactly 1 earth standing drops to 0', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 1)
      .addCard('dogtamer', 'player1', 'hand', { instanceId: 'dt1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'dt1' },
    });

    // Both options should still be available with 1 earth standing
    expect(playResult.state.pendingChoice!.type).toBe('choose_mode');
    if (playResult.state.pendingChoice!.type === 'choose_mode') {
      expect(playResult.state.pendingChoice!.modes).toHaveLength(2);
    }

    const migrateResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    expect(migrateResult.state.players.player1.standing.earth).toBe(0);
    expectPlayerMythium(migrateResult.state, 'player1', 7); // 5 - 1 + 3
  });

  it('is a 1/1 follower on the board after playing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('dogtamer', 'player1', 'hand', { instanceId: 'dt1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'dt1' },
    });

    expectCardInZone(playResult.state, 'dt1', 'board');
  });
});
