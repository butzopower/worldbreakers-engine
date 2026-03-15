import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectCardInZone, expectPlayerMythium } from '../../../helpers/assertions';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Proof of the Grotto', () => {
  hasPlayCost('proof_of_the_grotto', 1, { stars: 1 });

  it('reduces cost of played card by total standing across all guilds', () => {
    // 2 stars + 1 earth = 3 total standing → 3 mythium discount
    // shield_bearer costs 3, so it should be free after discount
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'stars', 2)
      .withStanding('player1', 'earth', 1)
      .addCard('proof_of_the_grotto', 'player1', 'hand', { instanceId: 'potg1' })
      .addCard('shield_bearer', 'player1', 'hand', { instanceId: 'sb1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'potg1' },
    });

    // Should prompt to choose a card to play
    expect(playResult.state.pendingChoice?.type).toBe('choose_target');

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    // Proof costs 1, shield_bearer (cost 3) with 3 standing discount = 0
    // Total spent: 1 (proof) + 0 (shield_bearer) = 1
    expectPlayerMythium(chooseResult.state, 'player1', 9);
    expectCardInZone(chooseResult.state, 'sb1', 'board');
  });

  it('with no extra standing beyond requirement, discount is just 1', () => {
    // 1 stars standing = 1 total → 1 mythium discount
    // militia_scout costs 1, with 1 discount = 0
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'stars', 1)
      .addCard('proof_of_the_grotto', 'player1', 'hand', { instanceId: 'potg1' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'potg1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    // 1 (proof) + 0 (militia_scout 1 - 1 discount) = 1
    expectPlayerMythium(chooseResult.state, 'player1', 9);
  });

  it('can play any card type, not just followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'stars', 1)
      .withStanding('player1', 'earth', 1)
      .addCard('proof_of_the_grotto', 'player1', 'hand', { instanceId: 'potg1' })
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'wt1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'potg1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'wt1' },
    });

    expectCardInZone(chooseResult.state, 'wt1', 'board');
  });

  it('event goes to discard after playing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'stars', 1)
      .addCard('proof_of_the_grotto', 'player1', 'hand', { instanceId: 'potg1' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'potg1' },
    });

    expectCardInZone(playResult.state, 'potg1', 'discard');
  });
});
