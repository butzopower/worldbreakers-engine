import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Irate Vandal', () => {
  hasPlayCost('irate_vandal', 2);

  it('can damage a location by removing a stage counter', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('irate_vandal', 'player1', 'hand', { instanceId: 'vandal1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'loc1', counters: { stage: 3 } })
      .build();

    let result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'vandal1' },
    });

    // Choose the location target
    result = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'loc1' },
    });

    const loc = result.state.cards.find(c => c.instanceId === 'loc1')!;
    expect(loc.counters.stage).toBe(2);
  });

  it('can damage a hidden location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('irate_vandal', 'player1', 'hand', { instanceId: 'vandal1' })
      .addCard('covert_exchange', 'player2', 'board', { instanceId: 'hidden1', counters: { stage: 3 } })
      .build();

    let result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'vandal1' },
    });

    // Choose the hidden location target
    result = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'hidden1' },
    });

    const loc = result.state.cards.find(c => c.instanceId === 'hidden1')!;
    expect(loc.counters.stage).toBe(2);
  });

  it('skips the choice when no locations are on the board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('irate_vandal', 'player1', 'hand', { instanceId: 'vandal1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'vandal1' },
    });

    // No pending choice since there are no locations
    expect(result.state.pendingChoice).toBeNull();
    expect(result.state.activePlayer).toBe('player2');
  });
});
