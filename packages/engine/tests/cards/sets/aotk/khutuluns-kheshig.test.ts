import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardCounter, expectPlayerPower } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe("Khutulun's Kheshig", () => {
  hasPlayCost('khutuluns_kheshig', 2, { earth: 1 });

  describe('Attacks: +1/+1 counter', () => {
    it('gains a +1/+1 counter when it attacks', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('khutuluns_kheshig', 'player1', 'board', { instanceId: 'kk1' })
        .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
        .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
        .build();

      const { state: s } = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['kk1'] },
      });

      expectCardCounter(s, 'kk1', 'plus_one_plus_one', 1);
    });

    it('counters accumulate across multiple attacks', () => {
      // Start with one existing +1/+1 counter (from a previous attack)
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('khutuluns_kheshig', 'player1', 'board', {
          instanceId: 'kk1',
          counters: { plus_one_plus_one: 1 },
        })
        .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
        .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
        .build();

      const { state: s } = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['kk1'] },
      });

      expectCardCounter(s, 'kk1', 'plus_one_plus_one', 2);
    });
  });
});
