import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Throes of Fancy', () => {
  hasPlayCost('throes_of_fancy', 1, { stars: 3 });

  it('reveals cards until it finds both a follower and a location, then draws both', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 3)
      .addCard('throes_of_fancy', 'player1', 'hand', { instanceId: 'tof1' })
      .addCard('mother_lode', 'player1', 'deck', { instanceId: 'ev1' }) // filler event
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('the_humble_underpass', 'player1', 'deck', { instanceId: 'loc1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'tof1' },
    });

    expectCardInZone(result.state, 'ms1', 'hand');
    expectCardInZone(result.state, 'loc1', 'hand');
    expectCardInZone(result.state, 'ev1', 'deck'); // filler stays in deck
    expect(result.state.pendingChoice?.type).toBe('choose_play_order');
    expect(result.state.pendingChoice?.cardInstanceIds).toHaveLength(2);
  });

  it('can play follower first then location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 3)
      .addCard('throes_of_fancy', 'player1', 'hand', { instanceId: 'tof1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('the_humble_underpass', 'player1', 'deck', { instanceId: 'loc1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'tof1' },
    });

    expect(result.state.pendingChoice?.type).toBe('choose_play_order');

    // Choose to play the follower first
    const playFollower = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_play', cardInstanceId: 'ms1' },
    });

    expectCardInZone(playFollower.state, 'ms1', 'board');

    // Now prompted for the remaining location
    expect(playFollower.state.pendingChoice?.type).toBe('choose_play_order');
    expect(playFollower.state.pendingChoice?.cardInstanceIds).toEqual(['loc1']);

    const playLocation = processAction(playFollower.state, {
      player: 'player1',
      action: { type: 'choose_play', cardInstanceId: 'loc1' },
    });

    expectCardInZone(playLocation.state, 'loc1', 'board');
    // 5 - 1 (Throes) - 1 (scout) - 2 (underpass) = 1
    expect(playLocation.state.players.player1.mythium).toBe(1);
  });

  it('can play location first then follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 3)
      .addCard('throes_of_fancy', 'player1', 'hand', { instanceId: 'tof1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('the_humble_underpass', 'player1', 'deck', { instanceId: 'loc1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'tof1' },
    });

    // Choose location first
    const playLocation = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_play', cardInstanceId: 'loc1' },
    });

    expectCardInZone(playLocation.state, 'loc1', 'board');
    expect(playLocation.state.pendingChoice?.cardInstanceIds).toEqual(['ms1']);

    const playFollower = processAction(playLocation.state, {
      player: 'player1',
      action: { type: 'choose_play', cardInstanceId: 'ms1' },
    });

    expectCardInZone(playFollower.state, 'ms1', 'board');
  });

  it('can skip both plays', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 3)
      .addCard('throes_of_fancy', 'player1', 'hand', { instanceId: 'tof1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('the_humble_underpass', 'player1', 'deck', { instanceId: 'loc1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'tof1' },
    });

    const skip1 = processAction(result.state, {
      player: 'player1',
      action: { type: 'skip_play', cardInstanceId: 'ms1' },
    });

    expect(skip1.state.pendingChoice?.cardInstanceIds).toEqual(['loc1']);

    const skip2 = processAction(skip1.state, {
      player: 'player1',
      action: { type: 'skip_play', cardInstanceId: 'loc1' },
    });

    expectCardInZone(skip2.state, 'ms1', 'hand');
    expectCardInZone(skip2.state, 'loc1', 'hand');
    expect(skip2.state.pendingChoice).toBeNull();
  });

  it('only prompts for follower if no location found in deck', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 3)
      .addCard('throes_of_fancy', 'player1', 'hand', { instanceId: 'tof1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'tof1' },
    });

    expectCardInZone(result.state, 'ms1', 'hand');
    expect(result.state.pendingChoice?.type).toBe('choose_play_order');
    expect(result.state.pendingChoice?.cardInstanceIds).toEqual(['ms1']);

    const skip = processAction(result.state, {
      player: 'player1',
      action: { type: 'skip_play', cardInstanceId: 'ms1' },
    });

    expect(skip.state.pendingChoice).toBeNull();
  });

  it('only prompts for location if no follower found in deck', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 3)
      .addCard('throes_of_fancy', 'player1', 'hand', { instanceId: 'tof1' })
      .addCard('the_humble_underpass', 'player1', 'deck', { instanceId: 'loc1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'tof1' },
    });

    expectCardInZone(result.state, 'loc1', 'hand');
    expect(result.state.pendingChoice?.cardInstanceIds).toEqual(['loc1']);

    const skip = processAction(result.state, {
      player: 'player1',
      action: { type: 'skip_play', cardInstanceId: 'loc1' },
    });

    expect(skip.state.pendingChoice).toBeNull();
  });

  it('shuffles the deck after revealing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'stars', 3)
      .addCard('throes_of_fancy', 'player1', 'hand', { instanceId: 'tof1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('the_humble_underpass', 'player1', 'deck', { instanceId: 'loc1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'tof1' },
    });

    expect(result.events.find(e => e.type === 'deck_shuffled')).toBeDefined();
  });
});
