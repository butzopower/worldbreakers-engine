import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectCardCounter, expectHandSize } from '../../../helpers/assertions';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Moon Apprentice', () => {
  hasPlayCost('moon_apprentice', 3);

  it('gains 1 moon standing on enter', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('moon_apprentice', 'player1', 'hand', { instanceId: 'ma1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ma1' },
    });

    expect(result.state.players.player1.standing.moon).toBe(1);
  });

  it('draws a card when controller has 3 standing in a guild', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .withStanding('player1', 'earth', 3)
      .addCard('moon_apprentice', 'player1', 'hand', { instanceId: 'ma1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ma1' },
    });

    // condition met — draws 1 card
    expectHandSize(result.state, 'player1', 1);
  });

  it('does not draw a card when no guild has 3 standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .withStanding('player1', 'earth', 2)
      .addCard('moon_apprentice', 'player1', 'hand', { instanceId: 'ma1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ma1' },
    });

    // condition not met — draws no card
    expectHandSize(result.state, 'player1', 0);
  });

  it('does draw a card when moon standing starts at 2', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .withStanding('player1', 'moon', 2)
      .addCard('moon_apprentice', 'player1', 'hand', { instanceId: 'ma1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ma1' },
    });

    // condition met because we gained 1 moon — draw 1 card
    expectHandSize(result.state, 'player1', 1);
  });
});
