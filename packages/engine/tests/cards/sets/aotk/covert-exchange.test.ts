import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectHandSize, expectCardInZone, expectCardCounter } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Covert Exchange', () => {
  hasPlayCost('covert_exchange', 2, { stars: 2 });

  it('enters board with 3 stage counters', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'stars', 2)
      .addCard('covert_exchange', 'player1', 'hand', { instanceId: 'ce1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ce1' },
    });

    expectCardInZone(result.state, 'ce1', 'board');
    expectCardCounter(result.state, 'ce1', 'stage', 3);
  });

  it('is hidden — opponent cannot target it via breach damage', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'stars', 2)
      .addCard('covert_exchange', 'player1', 'hand', { instanceId: 'ce1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ce1' },
    });

    // Simulate player2's turn: player2 attacks with ms1
    const attackResult = processAction(playResult.state, {
      player: 'player2',
      action: { type: 'attack', attackerIds: ['ms1'] },
    });

    // During breach player1 has covert_exchange — hidden — it should not be a valid breach target
    const legalActions = getLegalActions(attackResult.state);
    const breachTargets = legalActions
      .filter(a => a.action.type === 'damage_location')
      .map(a => a.action.type === 'damage_location' ? a.action.locationInstanceId : null);

    expect(breachTargets).not.toContain('ce1');
  });

  it('stage I: developing gains 4 mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('covert_exchange', 'player1', 'board', { instanceId: 'ce1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ce1' },
    });

    expectCardCounter(result.state, 'ce1', 'stage', 2);
    expectPlayerMythium(result.state, 'player1', 4);
  });

  it('stage II: developing draws 2 cards', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('covert_exchange', 'player1', 'board', { instanceId: 'ce1', counters: { stage: 2 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck2' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ce1' },
    });

    expectCardCounter(result.state, 'ce1', 'stage', 1);
    expectHandSize(result.state, 'player1', 2);
  });

  it('stage III: developing draws 1 card, gains 2 mythium, and depletes the location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('covert_exchange', 'player1', 'board', { instanceId: 'ce1', counters: { stage: 1 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ce1' },
    });

    expectHandSize(result.state, 'player1', 1);
    expectPlayerMythium(result.state, 'player1', 2);
    expectCardInZone(result.state, 'ce1', 'discard');
  });
});
