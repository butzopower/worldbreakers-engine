import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { hasPlayCost } from '../../../helpers/properties';
import { autoAccept } from '../../../helpers/game';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Heedless Investor', () => {
  hasPlayCost('heedless_investor', 1, { stars: 1 });

  it('gains 3 mythium when controller has a location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('heedless_investor', 'player1', 'hand', { instanceId: 'hi1' })
      .addCard('watchtower', 'player1', 'board', { instanceId: 'loc1', counters: { stage: 3 } })
      .build();

    const result = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'hi1' },
    }));

    // Started with 5, paid 1 for investor, gained 3 = 7
    expect(result.state.players.player1.mythium).toBe(7);
    expect(result.state.pendingChoice).toBeNull();
  });

  it('gains 1 standing in chosen guild when controller has no location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('heedless_investor', 'player1', 'hand', { instanceId: 'hi1' })
      .build();

    const playResult = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'hi1' },
    }));

    // Choose earth standing (mode 0 = earth)
    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(result.state.players.player1.standing.earth).toBe(1);
    expect(result.state.pendingChoice).toBeNull();
    expect(result.state.players.player1.mythium).toBe(4);
  });
});
