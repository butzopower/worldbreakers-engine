import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectHandSize, expectCardInZone } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Earth Apprentice', () => {
  it('costs 3 mythium to play', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('earth_apprentice', 'player1', 'hand', { instanceId: 'ea1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ea1' },
    });

    expectPlayerMythium(result.state, 'player1', 2);
    expectCardInZone(result.state, 'ea1', 'board');
  });

  it('gains 1 earth standing on enter', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('earth_apprentice', 'player1', 'hand', { instanceId: 'ea1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ea1' },
    });

    expect(result.state.players.player1.standing.earth).toBe(1);
  });

  it('does not draw a card with fewer than 2 other followers on board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('earth_apprentice', 'player1', 'hand', { instanceId: 'ea1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ea1' },
    });

    // Only 1 other follower on board, condition not met
    expectHandSize(result.state, 'player1', 0);
  });

  it('draws 1 card when controlling at least 2 other followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('earth_apprentice', 'player1', 'hand', { instanceId: 'ea1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms2' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ea1' },
    });

    // 2 other followers on board, condition met — draws 1 card
    expectHandSize(result.state, 'player1', 1);
  });

  it('gains standing AND draws a card when condition is met', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('earth_apprentice', 'player1', 'hand', { instanceId: 'ea1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms2' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ea1' },
    });

    // Both abilities resolve
    expect(result.state.players.player1.standing.earth).toBe(1);
    expectHandSize(result.state, 'player1', 1);
    expectCardInZone(result.state, 'ea1', 'board');
  });

  it('does not count opponent followers for the condition', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('earth_apprentice', 'player1', 'hand', { instanceId: 'ea1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms2' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ea1' },
    });

    // Opponent's followers don't count
    expectHandSize(result.state, 'player1', 0);
  });
});
