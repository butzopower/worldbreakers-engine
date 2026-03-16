import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction, getLegalActions } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectPlayerMythium, expectCardInZone, expectCardCounter } from '../../../helpers/assertions';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Surprising Development', () => {
  it('costs 3 mythium at full price', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('surprising_development', 'player1', 'hand', { instanceId: 'sd1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sd1' },
    });

    // No locations → skips discount → pays 3, gains 5 → net +2
    expectPlayerMythium(result.state, 'player1', 7);
  });

  it('can be played for free by damaging a location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('surprising_development', 'player1', 'hand', { instanceId: 'sd1' })
      .addCard('watchtower', 'player1', 'board', { instanceId: 'wt1', counters: { stage: 2 } })
      .build();

    // Play the event — should present cost discount choice
    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sd1' },
    });

    expect(playResult.state.pendingChoice?.type).toBe('choose_cost_discount');

    // Choose to damage the location for 3 mythium discount
    const discountResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_cost_discount_targets', targetInstanceIds: ['wt1'] },
    });

    // Card costs 3 - 3 discount = 0, gains 5 mythium
    expectPlayerMythium(discountResult.state, 'player1', 5);
    expectCardInZone(discountResult.state, 'sd1', 'discard');
    // Location lost a stage counter
    expectCardCounter(discountResult.state, 'wt1', 'stage', 1);
  });

  it('can skip the discount and pay full price', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('surprising_development', 'player1', 'hand', { instanceId: 'sd1' })
      .addCard('watchtower', 'player1', 'board', { instanceId: 'wt1', counters: { stage: 2 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sd1' },
    });

    // Skip discount
    const skipResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_cost_discount_targets', targetInstanceIds: [] },
    });

    // Paid full price: 5 - 3 + 5 = 7
    expectPlayerMythium(skipResult.state, 'player1', 7);
    // Location untouched
    expectCardCounter(skipResult.state, 'wt1', 'stage', 2);
  });

  it('cannot be played with 0 mythium and no locations', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('surprising_development', 'player1', 'hand', { instanceId: 'sd1' })
      .build();

    const actions = getLegalActions(state);
    const playActions = actions.filter(
      a => a.action.type === 'play_card' && a.action.cardInstanceId === 'sd1'
    );
    expect(playActions).toHaveLength(0);
  });

  it('can be played with 0 mythium when a location is available', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('surprising_development', 'player1', 'hand', { instanceId: 'sd1' })
      .addCard('watchtower', 'player1', 'board', { instanceId: 'wt1', counters: { stage: 2 } })
      .build();

    const actions = getLegalActions(state);
    const playActions = actions.filter(
      a => a.action.type === 'play_card' && a.action.cardInstanceId === 'sd1'
    );
    expect(playActions).toHaveLength(1);
  });

  it('skips discount automatically when no locations exist', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('surprising_development', 'player1', 'hand', { instanceId: 'sd1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sd1' },
    });

    // No locations to damage — should skip discount and play at full price
    // No pending choice, card resolved directly
    expectPlayerMythium(playResult.state, 'player1', 7);
    expectCardInZone(playResult.state, 'sd1', 'discard');
  });
});
