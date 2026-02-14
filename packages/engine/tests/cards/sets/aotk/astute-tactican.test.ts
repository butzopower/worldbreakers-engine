import { describe, it, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium } from '../../../helpers/assertions.js';
import { hasPlayCost } from "../../../helpers/properties";

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Astute Tactician', () => {
  hasPlayCost('astute_tactician', 5, { earth: 2 });

  it('Attacks: gain 2 Mythium', () => {
    const initialMythium = 2;
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', initialMythium)
      .addCard('astute_tactician', 'player1', 'board', { instanceId: 'at1' })
      .build();

    const { state: postAttackState } = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['at1'] },
    });

    expectPlayerMythium(postAttackState, 'player1', initialMythium + 2);
  })
});
