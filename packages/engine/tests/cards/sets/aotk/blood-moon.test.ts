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

describe('Blood Moon', () => {
  hasPlayCost('blood_moon', 7, { moon: 3 });

  it('presents choose_one when played', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'moon', 3)
      .addCard('blood_moon', 'player1', 'hand', { instanceId: 'bm1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bm1' },
    });

    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_mode');
  });

  it('defeating all followers moves every follower on board to discard', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'moon', 3)
      .addCard('blood_moon', 'player1', 'hand', { instanceId: 'bm1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms2' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bm1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expectCardInZone(chooseResult.state, 'ms1', 'discard');
    expectCardInZone(chooseResult.state, 'ms2', 'discard');
    expectCardInZone(chooseResult.state, 'sb1', 'discard');
    expect(chooseResult.state.pendingChoice).toBeNull();
    expect(chooseResult.state.activePlayer).toBe('player2');
  });

  it('depleting all locations moves every location on board to discard', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'moon', 3)
      .addCard('blood_moon', 'player1', 'hand', { instanceId: 'bm1' })
      .addCard('watchtower', 'player1', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt2', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bm1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    expectCardInZone(chooseResult.state, 'wt1', 'discard');
    expectCardInZone(chooseResult.state, 'wt2', 'discard');
    expect(chooseResult.state.pendingChoice).toBeNull();
    expect(chooseResult.state.activePlayer).toBe('player2');
  });

  it('defeat all followers does not affect locations', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'moon', 3)
      .addCard('blood_moon', 'player1', 'hand', { instanceId: 'bm1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bm1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 }, // Defeat all followers
    });

    expectCardInZone(chooseResult.state, 'ms1', 'discard');
    expectCardInZone(chooseResult.state, 'wt1', 'board');
  });

  it('deplete all locations does not affect followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'moon', 3)
      .addCard('blood_moon', 'player1', 'hand', { instanceId: 'bm1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bm1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 }, // Deplete all locations
    });

    expectCardInZone(chooseResult.state, 'wt1', 'discard');
    expectCardInZone(chooseResult.state, 'ms1', 'board');
  });
});
