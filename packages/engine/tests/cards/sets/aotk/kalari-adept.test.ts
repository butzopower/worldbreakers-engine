import { describe, it, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Kalari Adept', () => {
  hasPlayCost('kalari_adept', 1, { earth: 1 });

  it('attacks: gains 1 mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('kalari_adept', 'player1', 'board', { instanceId: 'ka1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ka1'] },
    });

    expectPlayerMythium(result.state, 'player1', 1);
  });
});
