import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectHandSize } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Eagle Huntress', () => {
  hasPlayCost('eagle_huntress', 2, { earth: 1 });

  it('migrate: choosing gain gives 1 earth standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 2)
      .addCard('eagle_huntress', 'player1', 'hand', { instanceId: 'eh1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'eh1' },
    });

    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(result.state.players.player1.standing.earth).toBe(2);
  });

  it('migrate: choosing migrate spends 1 earth standing and draws 2 cards', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 2)
      .addCard('eagle_huntress', 'player1', 'hand', { instanceId: 'eh1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck2' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'eh1' },
    });

    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    expect(result.state.players.player1.standing.earth).toBe(0);
    expectHandSize(result.state, 'player1', 2);
  });
});
