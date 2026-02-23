import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { hasPlayCost } from '../../../helpers/properties';
import { expectPlayerMythium } from '../../../helpers/assertions';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Lowly Bard', () => {
  hasPlayCost('lowly_bard', 2);

  it('gains mythium equal to total standing across all guilds', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .withStanding('player1', 'moon', 1)
      .withStanding('player1', 'stars', 3)
      .addCard('lowly_bard', 'player1', 'hand', { instanceId: 'bard1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bard1' },
    });

    // Started with 5, paid 2, gained 6 (2+1+0+3)
    expectPlayerMythium(result.state, 'player1', 9);
  });

  it('gains no mythium when player has no standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('lowly_bard', 'player1', 'hand', { instanceId: 'bard1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bard1' },
    });

    // Started with 5, paid 2, gained 0
    expectPlayerMythium(result.state, 'player1', 3);
  });

  it('counts standing from all four guilds', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'earth', 1)
      .withStanding('player1', 'moon', 1)
      .withStanding('player1', 'void', 1)
      .withStanding('player1', 'stars', 1)
      .addCard('lowly_bard', 'player1', 'hand', { instanceId: 'bard1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bard1' },
    });

    // Started with 10, paid 2, gained 4
    expectPlayerMythium(result.state, 'player1', 12);
  });
});
