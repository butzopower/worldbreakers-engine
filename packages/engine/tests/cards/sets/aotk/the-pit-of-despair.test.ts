import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectPlayerPower, expectHandSize, expectCardInZone, expectCardCounter } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Pit of Despair', () => {
  it('costs 7 mythium to play and enters with 3 stage counters', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 7)
      .addCard('the_pit_of_despair', 'player1', 'hand', { instanceId: 'pod1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pod1' },
    });

    expectCardInZone(result.state, 'pod1', 'board');
    expectCardCounter(result.state, 'pod1', 'stage', 3);
    expectPlayerMythium(result.state, 'player1', 0);
  });

  it('stage I: developing gains 2 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_pit_of_despair', 'player1', 'board', { instanceId: 'pod1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'pod1' },
    });

    expectCardCounter(result.state, 'pod1', 'stage', 2);
    expectPlayerPower(result.state, 'player1', 2);
  });

  it('stage II: developing gains 2 mythium and 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_pit_of_despair', 'player1', 'board', { instanceId: 'pod1', counters: { stage: 2 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'pod1' },
    });

    expectCardCounter(result.state, 'pod1', 'stage', 1);
    expectPlayerMythium(result.state, 'player1', 2);
    expectPlayerPower(result.state, 'player1', 1);
  });

  it('stage III: developing draws 2 cards and gains 1 power, then depletes', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_pit_of_despair', 'player1', 'board', { instanceId: 'pod1', counters: { stage: 1 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck2' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'pod1' },
    });

    expectHandSize(result.state, 'player1', 2);
    expectPlayerPower(result.state, 'player1', 1);
    expectCardInZone(result.state, 'pod1', 'discard');
  });
});
