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

describe('Airag Maker', () => {
  it('costs 2 mythium to play', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 1)
      .addCard('airag_maker', 'player1', 'hand', { instanceId: 'am1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'am1' },
    });

    expectPlayerMythium(result.state, 'player1', 3);
    expectCardInZone(result.state, 'am1', 'board');
  });

  it('requires 1 earth standing to play', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      // No earth standing
      .addCard('airag_maker', 'player1', 'hand', { instanceId: 'am1' })
      .build();

    expect(() => processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'am1' },
    })).toThrow('Invalid action');
  });

  it('creates a choose_mode pending choice with 4 guild options on enter', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'earth', 1)
      .addCard('airag_maker', 'player1', 'hand', { instanceId: 'am1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'am1' },
    });

    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_mode');
    if (result.state.pendingChoice!.type === 'choose_mode') {
      expect(result.state.pendingChoice!.modes).toHaveLength(4);
    }
  });

  it('choosing Earth gains 1 earth standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'earth', 1)
      .addCard('airag_maker', 'player1', 'hand', { instanceId: 'am1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'am1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(chooseResult.state.players.player1.standing.earth).toBe(2);
    expect(chooseResult.state.pendingChoice).toBeNull();
  });

  it('choosing Moon gains 1 moon standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'earth', 1)
      .addCard('airag_maker', 'player1', 'hand', { instanceId: 'am1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'am1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    expect(chooseResult.state.players.player1.standing.moon).toBe(1);
  });

  it('choosing Void gains 1 void standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'earth', 1)
      .addCard('airag_maker', 'player1', 'hand', { instanceId: 'am1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'am1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 2 },
    });

    expect(chooseResult.state.players.player1.standing.void).toBe(1);
  });

  it('choosing Stars gains 1 stars standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'earth', 1)
      .addCard('airag_maker', 'player1', 'hand', { instanceId: 'am1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'am1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 3 },
    });

    expect(chooseResult.state.players.player1.standing.stars).toBe(1);
  });

  it('getLegalActions returns all 4 mode options when pending', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'earth', 1)
      .addCard('airag_maker', 'player1', 'hand', { instanceId: 'am1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'am1' },
    });

    const legalActions = getLegalActions(playResult.state);
    expect(legalActions).toHaveLength(4);
    expect(legalActions[0]).toEqual({ player: 'player1', action: { type: 'choose_mode', modeIndex: 0 } });
    expect(legalActions[3]).toEqual({ player: 'player1', action: { type: 'choose_mode', modeIndex: 3 } });
  });

  it('turn advances after choosing a mode', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'earth', 1)
      .addCard('airag_maker', 'player1', 'hand', { instanceId: 'am1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'am1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(chooseResult.state.activePlayer).toBe('player2');
    expect(chooseResult.state.actionsTaken).toBe(1);
  });
});
