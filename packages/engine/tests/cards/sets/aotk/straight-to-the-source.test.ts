import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction, getLegalActions } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectPlayerMythium, expectCardInZone } from '../../../helpers/assertions';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Straight to the Source', () => {
  it('costs 2 mythium at full price', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 1)
      .addCard('straight_to_the_source', 'player1', 'hand', { instanceId: 'stts1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stts1' },
    });

    // No locations in hand → skips discount → pays 2, gains 3 → net +1
    expectPlayerMythium(result.state, 'player1', 6);
  });

  it('costs 1 less per location revealed from hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 1)
      .addCard('straight_to_the_source', 'player1', 'hand', { instanceId: 'stts1' })
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'wt1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stts1' },
    });

    expect(playResult.state.pendingChoice?.type).toBe('choose_cost_discount');

    // Reveal 1 location for 1 discount
    const discountResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_cost_discount_targets', targetInstanceIds: ['wt1'] },
    });

    // Paid 1 (2 - 1 discount), gained 3 → 5 - 1 + 3 = 7
    expectPlayerMythium(discountResult.state, 'player1', 7);
  });

  it('can reveal 2 locations to play for free', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .withStanding('player1', 'stars', 1)
      .withStanding('player1', 'earth', 1)
      .addCard('straight_to_the_source', 'player1', 'hand', { instanceId: 'stts1' })
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'wt1' })
      .addCard('void_nexus', 'player1', 'hand', { instanceId: 'vn1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stts1' },
    });

    // Reveal both locations for 2 discount → free
    const discountResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_cost_discount_targets', targetInstanceIds: ['wt1', 'vn1'] },
    });

    // Paid 0, gained 3
    expectPlayerMythium(discountResult.state, 'player1', 3);
    // Locations stay in hand (only revealed, not played)
    expectCardInZone(discountResult.state, 'wt1', 'hand');
    expectCardInZone(discountResult.state, 'vn1', 'hand');
  });

  it('can skip discount and pay full price', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 1)
      .addCard('straight_to_the_source', 'player1', 'hand', { instanceId: 'stts1' })
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'wt1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stts1' },
    });

    const skipResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_cost_discount_targets', targetInstanceIds: [] },
    });

    // Full price: 5 - 2 + 3 = 6
    expectPlayerMythium(skipResult.state, 'player1', 6);
  });

  it('requires 1 stars standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('straight_to_the_source', 'player1', 'hand', { instanceId: 'stts1' })
      .build();

    expect(() => processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stts1' },
    })).toThrow('Invalid action');
  });

  it('event goes to discard', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 1)
      .addCard('straight_to_the_source', 'player1', 'hand', { instanceId: 'stts1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stts1' },
    });

    expectCardInZone(result.state, 'stts1', 'discard');
  });
});
