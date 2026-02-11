import { describe, it, expect, beforeEach } from 'vitest';
import { registerTestCards } from '../../src/cards/test-cards/index.js';
import { clearRegistry } from '../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../src/engine/engine.js';
import { buildState } from '../helpers/state-builder.js';
import { expectPlayerMythium, expectHandSize, expectCardInZone } from '../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
});

describe('modal event card (choose one)', () => {
  it('playing strategic_insight creates a choose_mode pending choice with 2 modes', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('strategic_insight', 'player1', 'hand', { instanceId: 'si1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'si1' },
    });

    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_mode');
    if (result.state.pendingChoice!.type === 'choose_mode') {
      expect(result.state.pendingChoice!.modes).toHaveLength(2);
      expect(result.state.pendingChoice!.modes[0].label).toBe('Gain 2 mythium');
      expect(result.state.pendingChoice!.modes[1].label).toBe('Draw 2 cards');
    }
  });

  it('choosing mode 0 gains 2 mythium and advances turn', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('strategic_insight', 'player1', 'hand', { instanceId: 'si1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'si1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expectPlayerMythium(chooseResult.state, 'player1', 2);
    expect(chooseResult.state.pendingChoice).toBeNull();
    expect(chooseResult.state.activePlayer).toBe('player2');
    expect(chooseResult.state.actionsTaken).toBe(1);
  });

  it('choosing mode 1 draws 2 cards and advances turn', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('strategic_insight', 'player1', 'hand', { instanceId: 'si1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('shield_bearer', 'player1', 'deck', { instanceId: 'sb1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'si1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    // Started with si1 in hand (1), played it (0), drew 2 cards (2)
    expectHandSize(chooseResult.state, 'player1', 2);
    expectCardInZone(chooseResult.state, 'ms1', 'hand');
    expectCardInZone(chooseResult.state, 'sb1', 'hand');
    expect(chooseResult.state.pendingChoice).toBeNull();
    expect(chooseResult.state.activePlayer).toBe('player2');
    expect(chooseResult.state.actionsTaken).toBe(1);
  });

  it('getLegalActions returns both choose_mode options when pending', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('strategic_insight', 'player1', 'hand', { instanceId: 'si1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'si1' },
    });

    const legalActions = getLegalActions(playResult.state);
    expect(legalActions).toHaveLength(2);
    expect(legalActions[0]).toEqual({ player: 'player1', action: { type: 'choose_mode', modeIndex: 0 } });
    expect(legalActions[1]).toEqual({ player: 'player1', action: { type: 'choose_mode', modeIndex: 1 } });
  });

  it('invalid modeIndex is rejected by validator', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('strategic_insight', 'player1', 'hand', { instanceId: 'si1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'si1' },
    });

    expect(() => processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 5 },
    })).toThrow('Invalid action');

    expect(() => processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: -1 },
    })).toThrow('Invalid action');
  });

  it('event card goes to discard after playing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('strategic_insight', 'player1', 'hand', { instanceId: 'si1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'si1' },
    });

    // Event should be in discard even before mode is chosen
    expectCardInZone(playResult.state, 'si1', 'discard');
  });
});
