import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectHandSize, expectCardInZone } from '../../../helpers/assertions';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Callous Closer', () => {
  hasPlayCost('callous_closer', 5, { void: 2 });

  it('draws 1 card when another follower is defeated', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'void', 2)
      .addCard('callous_closer', 'player1', 'board', { instanceId: 'cc1' })
      .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'eo1' },
    });

    const result2 = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectHandSize(result2.state, 'player1', 1);
    expectCardInZone(result2.state, 'ms1', 'discard');
  });

  it('draws 1 card when itself is defeated', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'void', 2)
      .addCard('callous_closer', 'player1', 'board', { instanceId: 'cc1' })
      .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'eo1' },
    });

    const result2 = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'cc1' },
    });

    expectHandSize(result2.state, 'player1', 1);
    expectCardInZone(result2.state, 'cc1', 'discard');
  });

  it('does not draw if a follower was already defeated earlier this round', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'void', 2)
      .withDefeatedThisRound(['some_earlier_card'])
      .addCard('callous_closer', 'player1', 'board', { instanceId: 'cc1' })
      .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'eo1' },
    });

    const result2 = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectHandSize(result2.state, 'player1', 0);
  });
});
