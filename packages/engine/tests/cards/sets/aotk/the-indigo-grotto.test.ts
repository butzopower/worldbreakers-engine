import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectPlayerPower, expectCardInZone, expectCardCounter } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Indigo Grotto', () => {
  it('costs 9 mythium to play and enters with 3 stage counters', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 9)
      .addCard('the_indigo_grotto', 'player1', 'hand', { instanceId: 'ig1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ig1' },
    });

    expectCardInZone(result.state, 'ig1', 'board');
    expectCardCounter(result.state, 'ig1', 'stage', 3);
    expectPlayerMythium(result.state, 'player1', 0);
  });

  it('stage I: developing gains 2 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'ig1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ig1' },
    });

    expectCardCounter(result.state, 'ig1', 'stage', 2);
    expectPlayerPower(result.state, 'player1', 2);
  });

  it('stage II: developing gains 3 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'ig1', counters: { stage: 2 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ig1' },
    });

    expectCardCounter(result.state, 'ig1', 'stage', 1);
    expectPlayerPower(result.state, 'player1', 3);
  });

  it('stage III: developing gains 1 power and depletes the location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_indigo_grotto', 'player1', 'board', { instanceId: 'ig1', counters: { stage: 1 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ig1' },
    });

    expectPlayerPower(result.state, 'player1', 1);
    expectCardInZone(result.state, 'ig1', 'discard');
  });

  it('has no standing requirement', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 9)
      .addCard('the_indigo_grotto', 'player1', 'hand', { instanceId: 'ig1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ig1' },
    });

    expectCardInZone(result.state, 'ig1', 'board');
  });
});
