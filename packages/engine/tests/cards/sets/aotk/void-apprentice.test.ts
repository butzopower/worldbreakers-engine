import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectHandSize, expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';
import { autoAccept } from '../../../helpers/game';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Void Apprentice', () => {
  hasPlayCost('void_apprentice', 3);

  it('gains 1 void standing on enter', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('void_apprentice', 'player1', 'hand', { instanceId: 'va1' })
      .build();

    const result = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'va1' },
    }));

    expect(result.state.players.player1.standing.void).toBe(1);
    expectCardInZone(result.state, 'va1', 'board');
  });

  it('does not draw a card when no follower was defeated this round', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('void_apprentice', 'player1', 'hand', { instanceId: 'va1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'va1' },
    }));

    expectHandSize(result.state, 'player1', 0);
  });

  it('draws 1 card when a follower was defeated this round', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .withDefeatedThisRound(['some_defeated_card'])
      .addCard('void_apprentice', 'player1', 'hand', { instanceId: 'va1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'va1' },
    });

    const result = autoAccept(autoAccept(playResult));

    expectHandSize(result.state, 'player1', 1);
  });

  it('gains void standing AND draws when condition is met', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .withDefeatedThisRound(['some_defeated_card'])
      .addCard('void_apprentice', 'player1', 'hand', { instanceId: 'va1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'va1' },
    });

    const result = autoAccept(autoAccept(playResult));

    expect(result.state.players.player1.standing.void).toBe(1);
    expectHandSize(result.state, 'player1', 1);
    expectCardInZone(result.state, 'va1', 'board');
  });
});
