import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectPlayerMythium, expectCardInZone } from '../../../helpers/assertions';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Serendipitous Witness', () => {
  hasPlayCost('serendipitous_witness', 3, { void: 1 });

  it('gains 1 mythium when another follower is defeated', () => {
    // Witness on board, use sudden_strike (needs earth standing) to defeat opponent's follower
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'void', 1)
      .withStanding('player1', 'earth', 1)
      .addCard('serendipitous_witness', 'player1', 'board', { instanceId: 'sw1' })
      .addCard('sudden_strike', 'player1', 'hand', { instanceId: 'ss1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    // Play sudden_strike (cost 1) to deal 2 wounds to militia_scout (1 health)
    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ss1' },
    });

    // Choose militia_scout as target
    const result2 = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    // Started with 10, spent 1 on sudden_strike = 9, gained 1 from witness = 10
    expectPlayerMythium(result2.state, 'player1', 10);
    expectCardInZone(result2.state, 'ms1', 'discard');
  });

  it('gains 1 mythium when itself is defeated', () => {
    // Use execution_order (cost 0, no standing req) to destroy the witness itself
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'void', 1)
      .addCard('serendipitous_witness', 'player1', 'board', { instanceId: 'sw1' })
      .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
      .build();

    // Play execution_order to destroy witness
    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'eo1' },
    });

    // Choose witness as target
    const result2 = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sw1' },
    });

    // Witness triggers before being moved to discard: gain 1 mythium
    // Started with 10, spent 0 on execution_order, gained 1 from witness = 11
    expectPlayerMythium(result2.state, 'player1', 11);
    expectCardInZone(result2.state, 'sw1', 'discard');
  });

  it('only triggers once per round — second defeat does not fire', () => {
    // Two followers defeated in same cleanup — only the first triggers witness
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'void', 1)
      .withStanding('player1', 'earth', 1)
      .addCard('serendipitous_witness', 'player1', 'board', { instanceId: 'sw1' })
      .addCard('sudden_strike', 'player1', 'hand', { instanceId: 'ss1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      // Second follower already wounded enough to be defeated when cleanup runs
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms2', counters: { wound: 1 } })
      .build();

    // Play sudden_strike to wound ms1 — cleanup will find both ms1 and ms2 defeated
    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ss1' },
    });

    const result2 = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    // Started with 10, spent 1 on sudden_strike = 9, gained 1 from witness (first defeat only) = 10
    expectPlayerMythium(result2.state, 'player1', 10);
  });

  it('does not fire if a follower was already defeated earlier this round', () => {
    // A follower was defeated earlier this round (defeatedThisRound already populated)
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'void', 1)
      .withDefeatedThisRound(['some_earlier_card'])
      .addCard('serendipitous_witness', 'player1', 'board', { instanceId: 'sw1' })
      .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'eo1' },
    });

    const result2 = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    // No witness trigger because first defeat was earlier this round
    // Started with 10, spent 0 on execution_order = 10
    expectPlayerMythium(result2.state, 'player1', 10);
  });
});
