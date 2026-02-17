import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectCardInZone, expectHandSize } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Stars Apprentice', () => {
  it('gains 1 stars standing on enter', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('stars_apprentice', 'player1', 'hand', { instanceId: 'sa1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sa1' },
    });

    expectCardInZone(result.state, 'sa1', 'board');
    expect(result.state.players.player1.standing.stars).toBe(1);
    expectPlayerMythium(result.state, 'player1', 2); // 5 - 3 cost
  });

  it('draws 1 card when controller has a location on board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('stars_apprentice', 'player1', 'hand', { instanceId: 'sa1' })
      .addCard('watchtower', 'player1', 'board', { instanceId: 'wt1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms_deck' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sa1' },
    });

    // Drew 1 card from the location condition
    expectCardInZone(result.state, 'ms_deck', 'hand');
  });

  it('does not draw when controller has no location on board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('stars_apprentice', 'player1', 'hand', { instanceId: 'sa1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms_deck' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sa1' },
    });

    // No location → no draw
    expectCardInZone(result.state, 'ms_deck', 'deck');
  });

  it('opponent location does not trigger the draw', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('stars_apprentice', 'player1', 'hand', { instanceId: 'sa1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms_deck' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sa1' },
    });

    // Opponent's location doesn't count
    expectCardInZone(result.state, 'ms_deck', 'deck');
  });

  it('still gains stars standing even without a location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 1)
      .addCard('stars_apprentice', 'player1', 'hand', { instanceId: 'sa1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sa1' },
    });

    expect(result.state.players.player1.standing.stars).toBe(2);
  });
});
