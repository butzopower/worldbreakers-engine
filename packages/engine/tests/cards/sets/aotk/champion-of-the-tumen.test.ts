import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerPower, expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Champion of the Tumen', () => {
  hasPlayCost('champion_of_the_tumen', 4, { earth: 1});

  it('overwhelm: gains 1 power when it defeats a blocker', () => {
    // Champion (4 str) vs militia_scout (1 health) — blocker is defeated
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('champion_of_the_tumen', 'player1', 'board', { instanceId: 'cot1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['cot1'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ms1', attackerId: 'cot1' },
    });

    // militia_scout defeated, champion survives, overwhelm fires
    expectCardInZone(blockResult.state, 'ms1', 'discard');
    expectPlayerPower(blockResult.state, 'player1', 1);
  });
});
