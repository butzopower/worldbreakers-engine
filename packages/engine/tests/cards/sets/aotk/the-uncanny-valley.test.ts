import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectPlayerPower, expectHandSize, expectCardInZone, expectCardCounter } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Uncanny Valley', () => {
  hasPlayCost('the_uncanny_valley', 5, { stars: 3 });

  it('enters board with 3 stage counters', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 3)
      .addCard('the_uncanny_valley', 'player1', 'hand', { instanceId: 'uv1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'uv1' },
    });

    expectCardInZone(result.state, 'uv1', 'board');
    expectCardCounter(result.state, 'uv1', 'stage', 3);
  });

  it('stage I: gain 1 mythium and 1 power, opponent loses 1 mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player2', 3)
      .addCard('the_uncanny_valley', 'player1', 'board', { instanceId: 'uv1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'uv1' },
    });

    expectCardCounter(result.state, 'uv1', 'stage', 2);
    expectPlayerMythium(result.state, 'player1', 1);
    expectPlayerPower(result.state, 'player1', 1);
    expectPlayerMythium(result.state, 'player2', 2);
  });

  it('stage I: opponent loses 0 mythium when they have none', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player2', 0)
      .addCard('the_uncanny_valley', 'player1', 'board', { instanceId: 'uv1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'uv1' },
    });

    expectPlayerMythium(result.state, 'player2', 0);
    expectPlayerMythium(result.state, 'player1', 1);
  });

  it('stage II: draw 1 card, gain 1 power, opponent discards a card', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_uncanny_valley', 'player1', 'board', { instanceId: 'uv1', counters: { stage: 2 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .addCard('militia_scout', 'player2', 'hand', { instanceId: 'opp_hand1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'uv1' },
    });

    // Opponent should have a pending discard choice
    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_discard');

    const discardResult = processAction(result.state, {
      player: 'player2',
      action: { type: 'choose_discard', cardInstanceIds: ['opp_hand1'] },
    });

    expectCardCounter(discardResult.state, 'uv1', 'stage', 1);
    expectHandSize(discardResult.state, 'player1', 1);
    expectPlayerPower(discardResult.state, 'player1', 1);
    expectCardInZone(discardResult.state, 'opp_hand1', 'discard');
  });

  it('stage II: skips opponent discard when opponent has no cards in hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_uncanny_valley', 'player1', 'board', { instanceId: 'uv1', counters: { stage: 2 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'uv1' },
    });

    // No pending discard since opponent has no hand
    expectCardCounter(result.state, 'uv1', 'stage', 1);
    expectHandSize(result.state, 'player1', 1);
    expectPlayerPower(result.state, 'player1', 1);
  });

  it('stage III: gain 1 power, opponent loses 1 power, location depletes', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withPower('player2', 3)
      .addCard('the_uncanny_valley', 'player1', 'board', { instanceId: 'uv1', counters: { stage: 1 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'uv1' },
    });

    expectPlayerPower(result.state, 'player1', 1);
    expectPlayerPower(result.state, 'player2', 2);
    expectCardInZone(result.state, 'uv1', 'discard');
  });

  it('stage III: opponent loses 0 power when they have none', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withPower('player2', 0)
      .addCard('the_uncanny_valley', 'player1', 'board', { instanceId: 'uv1', counters: { stage: 1 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'uv1' },
    });

    expectPlayerPower(result.state, 'player1', 1);
    expectPlayerPower(result.state, 'player2', 0);
  });
});
