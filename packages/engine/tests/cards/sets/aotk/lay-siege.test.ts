import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Lay Siege', () => {
  hasPlayCost('lay_siege', 3, { earth: 2 });

  it('presents choose_target for a non-hidden location on the board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('lay_siege', 'player1', 'hand', { instanceId: 'ls1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ls1' },
    });

    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_target');
  });

  it('depletes the chosen location — moves it to discard', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('lay_siege', 'player1', 'hand', { instanceId: 'ls1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ls1' },
    });

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'wt1' },
    });

    expectCardInZone(targetResult.state, 'wt1', 'discard');
    expect(targetResult.state.pendingChoice).toBeNull();
    expect(targetResult.state.activePlayer).toBe('player2');
  });

  it('can target the player\'s own location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('lay_siege', 'player1', 'hand', { instanceId: 'ls1' })
      .addCard('watchtower', 'player1', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ls1' },
    });

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'wt1' },
    });

    expectCardInZone(targetResult.state, 'wt1', 'discard');
  });

  it('cannot target a hidden location — effect is skipped', () => {
    // void_nexus has the hidden keyword — Lay Siege cannot target it
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('lay_siege', 'player1', 'hand', { instanceId: 'ls1' })
      .addCard('void_nexus', 'player2', 'board', { instanceId: 'vn1', counters: { stage: 2 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ls1' },
    });

    // No valid targets — effect skipped, turn advances
    expect(result.state.pendingChoice).toBeNull();
    expect(result.state.activePlayer).toBe('player2');
    expectCardInZone(result.state, 'vn1', 'board');
  });

  it('with a hidden and a non-hidden location, only the non-hidden one can be targeted', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('lay_siege', 'player1', 'hand', { instanceId: 'ls1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .addCard('void_nexus', 'player2', 'board', { instanceId: 'vn1', counters: { stage: 2 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ls1' },
    });

    expect(playResult.state.pendingChoice!.type).toBe('choose_target');

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'wt1' },
    });

    expectCardInZone(targetResult.state, 'wt1', 'discard');
    // Hidden location is untouched
    expectCardInZone(targetResult.state, 'vn1', 'board');
  });
});
