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

describe('Generous Dealer', () => {
  it('reduces the cost of events by 1 while on board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 6)
      .withStanding('player1', 'stars', 2)
      .addCard('generous_dealer', 'player1', 'board', { instanceId: 'gd1' })
      .addCard('frantic_getaway', 'player1', 'hand', { instanceId: 'fg1' })
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'ig1', counters: { stage: 3 } })
      .build();

    // frantic_getaway costs 1; with dealer it costs 0, so 6 mythium should remain after
    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'fg1' },
    });

    // Choose a target to resolve the pending develop
    const resolved = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });
    const secondResolve = processAction(resolved.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });

    expectPlayerMythium(secondResolve.state, 'player1', 6); // paid 0 instead of 1
  });

  it('reduces the cost of locations by 1 while on board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 1)
      .addCard('generous_dealer', 'player1', 'board', { instanceId: 'gd1' })
      .addCard('the_humble_underpass', 'player1', 'hand', { instanceId: 'hu1' })
      .build();

    // the_humble_underpass normally costs 2; with dealer costs 1
    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'hu1' },
    });

    expectCardInZone(result.state, 'hu1', 'board');
    expectPlayerMythium(result.state, 'player1', 4); // 5 - 1
  });

  it('does not reduce the cost of followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 4)
      .withStanding('player1', 'stars', 1)
      .addCard('generous_dealer', 'player1', 'board', { instanceId: 'gd1' })
      .addCard('stars_apprentice', 'player1', 'hand', { instanceId: 'sa1' })
      .build();

    // stars_apprentice costs 3 — no discount for followers
    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sa1' },
    });

    expectCardInZone(result.state, 'sa1', 'board');
    expectPlayerMythium(result.state, 'player1', 1); // 4 - 3
  });

  it('discount does not apply to opponent events', () => {
    const state = buildState()
      .withActivePlayer('player2')
      .withMythium('player1', 5)
      .withMythium('player2', 2)
      .withStanding('player2', 'stars', 2)
      .addCard('generous_dealer', 'player1', 'board', { instanceId: 'gd1' })
      .addCard('frantic_getaway', 'player2', 'hand', { instanceId: 'fg1' })
      .addCard('the_indigo_grotto', 'player2', 'board', { instanceId: 'ig1', counters: { stage: 3 } })
      .build();

    // player2 pays full cost of 1 (dealer belongs to player1)
    const result = processAction(state, {
      player: 'player2',
      action: { type: 'play_card', cardInstanceId: 'fg1' },
    });

    const resolved = processAction(result.state, {
      player: 'player2',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });
    const secondResolve = processAction(resolved.state, {
      player: 'player2',
      action: { type: 'choose_target', targetInstanceId: 'ig1' },
    });

    expectPlayerMythium(secondResolve.state, 'player2', 1); // 2 - 1 full cost
  });

  it('makes events playable that would otherwise be too expensive', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .withStanding('player1', 'stars', 2)
      .addCard('generous_dealer', 'player1', 'board', { instanceId: 'gd1' })
      .addCard('frantic_getaway', 'player1', 'hand', { instanceId: 'fg1' })
      .build();

    const legal = getLegalActions(state);
    const canPlay = legal.some(a => a.action.type === 'play_card' && a.action.cardInstanceId === 'fg1');
    expect(canPlay).toBe(true);
  });

  it('event is not playable without dealer when mythium is too low', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .withStanding('player1', 'stars', 2)
      .addCard('frantic_getaway', 'player1', 'hand', { instanceId: 'fg1' })
      .build();

    const legal = getLegalActions(state);
    const canPlay = legal.some(a => a.action.type === 'play_card' && a.action.cardInstanceId === 'fg1');
    expect(canPlay).toBe(false);
  });

  it('costs 0 minimum (never negative)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'stars', 1)
      .addCard('generous_dealer', 'player1', 'board', { instanceId: 'gd1' })
      .addCard('mythium_fund', 'player1', 'hand', { instanceId: 'mf1' })
      .build();

    // mythium_fund costs 5; with 1 dealer reduction → 4
    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'mf1' },
    });

    expectPlayerMythium(result.state, 'player1', 15); // 10 - 4 + 9
  });
});
