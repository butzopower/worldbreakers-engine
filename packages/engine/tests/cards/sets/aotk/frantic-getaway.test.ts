import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone, expectCardCounter, expectPlayerPower } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Frantic Getaway', () => {
  it('creates a choose_target pending choice when a developable location is on board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'stars', 2)
      .addCard('frantic_getaway', 'player1', 'hand', { instanceId: 'fg1' })
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'ig1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'fg1' },
    });

    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_target');
  });

  it('after choosing first location, a second choose_target pending choice appears', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'stars', 2)
      .addCard('frantic_getaway', 'player1', 'hand', { instanceId: 'fg1' })
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'ig1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'fg1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });

    // After first develop, location still has 2 stages left, so second choice appears
    expect(chooseResult.state.pendingChoice).not.toBeNull();
    expect(chooseResult.state.pendingChoice!.type).toBe('choose_target');
  });

  it('can develop two different locations (one stage each)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'stars', 2)
      .addCard('frantic_getaway', 'player1', 'hand', { instanceId: 'fg1' })
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'ig1', counters: { stage: 3 } })
      .addCard('the_pit_of_despair', 'player1', 'board', { instanceId: 'pd1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'fg1' },
    });

    // Choose first location
    const firstChoose = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });

    // Choose second location
    const secondChoose = processAction(firstChoose.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'pd1' },
    });

    // Both locations developed once
    expectCardCounter(secondChoose.state, 'ig1', 'stage', 2);
    expectCardCounter(secondChoose.state, 'pd1', 'stage', 2);
    // Indigo Grotto stage I = 2 power, Pit of Despair stage I = 2 power
    expectPlayerPower(secondChoose.state, 'player1', 4);
    expect(secondChoose.state.pendingChoice).toBeNull();
  });

  it('can develop the same location twice (two stages)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'stars', 2)
      .addCard('frantic_getaway', 'player1', 'hand', { instanceId: 'fg1' })
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'ig1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'fg1' },
    });

    const firstChoose = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });

    const secondChoose = processAction(firstChoose.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });

    // Developed twice: 3 -> 2 -> 1 stages remaining
    expectCardCounter(secondChoose.state, 'ig1', 'stage', 1);
    // Stage I = 2 power, Stage II = 3 power
    expectPlayerPower(secondChoose.state, 'player1', 5);
    expect(secondChoose.state.pendingChoice).toBeNull();
  });

  it('if first develop depletes a location (1 stage left), second choice still appears for other locations', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'stars', 2)
      .addCard('frantic_getaway', 'player1', 'hand', { instanceId: 'fg1' })
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'ig1', counters: { stage: 1 } })
      .addCard('the_pit_of_despair', 'player1', 'board', { instanceId: 'pd1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'fg1' },
    });

    // Develop the location with 1 stage left - it will deplete
    const firstChoose = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });

    // First location depleted (moved to discard)
    expectCardInZone(firstChoose.state, 'ig1', 'discard');
    // Second choice should appear for the other location
    expect(firstChoose.state.pendingChoice).not.toBeNull();
    expect(firstChoose.state.pendingChoice!.type).toBe('choose_target');

    // Choose the second location
    const secondChoose = processAction(firstChoose.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'pd1' },
    });

    expectCardCounter(secondChoose.state, 'pd1', 'stage', 2);
    expect(secondChoose.state.pendingChoice).toBeNull();
  });

  it('if first develop depletes the only location, no second choice (resolves cleanly)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'stars', 2)
      .addCard('frantic_getaway', 'player1', 'hand', { instanceId: 'fg1' })
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'ig1', counters: { stage: 1 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'fg1' },
    });

    const firstChoose = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });

    // Location depleted, no other locations, resolves cleanly
    expectCardInZone(firstChoose.state, 'ig1', 'discard');
    expect(firstChoose.state.pendingChoice).toBeNull();
    // Turn should advance
    expect(firstChoose.state.activePlayer).toBe('player2');
  });

  it('fizzles when no developable locations on board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'stars', 2)
      .addCard('frantic_getaway', 'player1', 'hand', { instanceId: 'fg1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'fg1' },
    });

    // No locations - fizzles, turn advances
    expect(result.state.pendingChoice).toBeNull();
    expectCardInZone(result.state, 'fg1', 'discard');
    expect(result.state.activePlayer).toBe('player2');
    expect(result.state.actionsTaken).toBe(1);
  });

  it('turn advances after both develops resolve', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'stars', 2)
      .addCard('frantic_getaway', 'player1', 'hand', { instanceId: 'fg1' })
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'ig1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'fg1' },
    });

    const firstChoose = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });

    const secondChoose = processAction(firstChoose.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });

    expect(secondChoose.state.activePlayer).toBe('player2');
    expect(secondChoose.state.actionsTaken).toBe(1);
  });
});
