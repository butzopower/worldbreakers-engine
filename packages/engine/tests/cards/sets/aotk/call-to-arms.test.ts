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

describe('Call to Arms', () => {
  hasPlayCost('call_to_arms', 0, { earth: 1 });

  it('draws the first two follower cards from the deck, skipping non-followers', () => {
    // deck top-to-bottom: event, follower, follower, follower
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 0)
      .addCard('call_to_arms', 'player1', 'hand', { instanceId: 'cta1' })
      .addCard('mother_lode', 'player1', 'deck', { instanceId: 'ev1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms2' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms3' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'cta1' },
    });

    // First two followers are drawn to hand
    expectCardInZone(result.state, 'ms1', 'hand');
    expectCardInZone(result.state, 'ms2', 'hand');
    // Non-follower and un-reached follower are shuffled back to deck
    expectCardInZone(result.state, 'ev1', 'deck');
    expectCardInZone(result.state, 'ms3', 'deck');
  });

  it('prompts to optionally play one of the drawn followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 1)
      .addCard('call_to_arms', 'player1', 'hand', { instanceId: 'cta1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms2' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'cta1' },
    });

    expect(result.waitingFor?.type).toBe('choose_mode');
  });

  it('playing one of the drawn followers puts it on the board paying its cost', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 1)
      .addCard('call_to_arms', 'player1', 'hand', { instanceId: 'cta1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms2' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'cta1' },
    });

    // Choose to play a follower (mode 0)
    const modeResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    const result = processAction(modeResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectCardInZone(result.state, 'ms1', 'board');
    expectCardInZone(result.state, 'ms2', 'hand');
    expect(result.state.players.player1.mythium).toBe(0); // paid 1 for militia_scout
  });

  it('cannot play card follower that was not drawn by event', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 1)
      .addCard('call_to_arms', 'player1', 'hand', { instanceId: 'cta1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms2' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms3' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'cta1' },
    });

    // Choose to play a follower (mode 0)
    const modeResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(() => processAction(modeResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms3' },
    })).toThrow('Invalid action');
  });

  it('passing skips the play and both drawn followers remain in hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 1)
      .addCard('call_to_arms', 'player1', 'hand', { instanceId: 'cta1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms2' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'cta1' },
    });

    // Choose to pass (mode 1)
    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    expectCardInZone(result.state, 'ms1', 'hand');
    expectCardInZone(result.state, 'ms2', 'hand');
    expect(result.state.pendingChoice).toBeNull();
  });

  it('draws only the one available follower when the deck has fewer than two', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 0)
      .addCard('call_to_arms', 'player1', 'hand', { instanceId: 'cta1' })
      .addCard('mother_lode', 'player1', 'deck', { instanceId: 'ev1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'cta1' },
    });

    expectCardInZone(result.state, 'ms1', 'hand');
    expectCardInZone(result.state, 'ev1', 'deck');
  });
});
