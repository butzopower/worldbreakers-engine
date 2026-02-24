import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectCardCounter } from '../../../helpers/assertions';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Weary Veteran', () => {
  hasPlayCost('weary_veteran', 1);

  it('gets a +1/+1 counter when controller has 3 standing in a guild', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 3)
      .addCard('weary_veteran', 'player1', 'hand', { instanceId: 'wv1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'wv1' },
    });

    expectCardCounter(result.state, 'wv1', 'plus_one_plus_one', 1);
  });

  it('does not get a counter when no guild has 3 standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .withStanding('player1', 'moon', 2)
      .addCard('weary_veteran', 'player1', 'hand', { instanceId: 'wv1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'wv1' },
    });

    expectCardCounter(result.state, 'wv1', 'plus_one_plus_one', 0);
  });

  it('works with any guild at 3 standing (not just earth)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('weary_veteran', 'player1', 'hand', { instanceId: 'wv1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'wv1' },
    });

    expectCardCounter(result.state, 'wv1', 'plus_one_plus_one', 1);
  });
});
