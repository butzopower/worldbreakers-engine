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

describe('Illicit Bazaar', () => {
  hasPlayCost('illicit_bazaar', 0, { stars: 1 });

  it('stage I grants 2 mythium and 1 standing with any guild', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('illicit_bazaar', 'player1', 'board', { instanceId: 'ib1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ib1' },
    });

    // Should prompt for guild choice
    expect(result.waitingFor?.type).toBe('choose_mode');

    const chooseResult = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(chooseResult.state.players.player1.mythium).toBe(7);
    expect(chooseResult.state.players.player1.standing.earth).toBe(1);
  });

  it('stage II grants 2 mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('illicit_bazaar', 'player1', 'board', { instanceId: 'ib1', counters: { stage: 2 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ib1' },
    });

    expect(result.state.players.player1.mythium).toBe(7);
  });

  it('stage III grants 2 mythium and depletes', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 1)
      .withMythium('player1', 5)
      .addCard('illicit_bazaar', 'player1', 'board', { instanceId: 'ib1', counters: { stage: 1 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ib1' },
    });

    expect(result.state.players.player1.mythium).toBe(7);
    expectCardInZone(result.state, 'ib1', 'discard');
  });
});
