import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Alamut Emissary', () => {
  hasPlayCost('alamut_emissary', 4, { void: 2 });

  it('bloodshed 1 deals 1 extra wound to the blocker', () => {
    // Emissary (2 str + bloodshed 1) vs shield_bearer (3 health)
    // Without bloodshed: 2 wounds < 3 health → shield_bearer survives
    // With bloodshed 1: 2 + 1 = 3 wounds = 3 health → shield_bearer defeated
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('alamut_emissary', 'player1', 'board', { instanceId: 'ae1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ae1'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'sb1', attackerId: 'ae1' },
    });

    expectCardInZone(blockResult.state, 'sb1', 'discard');
  });

  it('bloodshed only triggers when attacking alone', () => {
    // Emissary (4 health) survives 1 wound from shield_bearer (1 str)
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('alamut_emissary', 'player1', 'board', { instanceId: 'ae1' })
      .addCard('alamut_emissary', 'player1', 'board', { instanceId: 'ae2' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ae1', 'ae2'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'sb1', attackerId: 'ae1' },
    });

    expectCardInZone(blockResult.state, 'sb1', 'board');
  });
});
