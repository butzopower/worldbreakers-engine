import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone, expectCardCounter, expectPlayerPower } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Forlorn Flats', () => {
  hasPlayCost('forlorn_flats', 4, { void: 1 });

  it('stage I: gains 1 void standing and 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('forlorn_flats', 'player1', 'board', { instanceId: 'ff1', counters: { stage: 2 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ff1' },
    });

    expectCardCounter(result.state, 'ff1', 'stage', 1);
    expect(result.state.players.player1.standing.void).toBe(1);
    expectPlayerPower(result.state, 'player1', 1);
  });

  it('stage II: gains 1 power and deals 2 wounds to a follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('forlorn_flats', 'player1', 'board', { instanceId: 'ff1', counters: { stage: 1 } })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' }) // 1/3
      .build();

    const developResult = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ff1' },
    });

    // Choose target for 2 wounds
    const result = processAction(developResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    expectPlayerPower(result.state, 'player1', 1);
    expectCardCounter(result.state, 'sb1', 'wound', 2);
    expectCardInZone(result.state, 'ff1', 'discard');
  });
});
