import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Mythium Fund', () => {
  it('costs 5 mythium to play', () => {
    // Cannot play without 5 mythium
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 4)
      .addCard('mythium_fund', 'player1', 'hand', { instanceId: 'mf1' })
      .build();

    expect(() => processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'mf1' },
    })).toThrow('Invalid action');
  });

  it('gains 9 mythium when played (net +4 after paying 5)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('mythium_fund', 'player1', 'hand', { instanceId: 'mf1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'mf1' },
    });

    // Spent 5, gained 9 → net +4
    expectPlayerMythium(result.state, 'player1', 9);
  });

  it('has no standing requirement', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      // no standing set
      .addCard('mythium_fund', 'player1', 'hand', { instanceId: 'mf1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'mf1' },
    });

    expectPlayerMythium(result.state, 'player1', 9);
  });
});
