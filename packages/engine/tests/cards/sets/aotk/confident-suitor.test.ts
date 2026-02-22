import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone, expectPlayerMythium } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Confident Suitor', () => {
  hasPlayCost('confident_suitor', 4, { earth: 2 });

  it('gains 6 mythium and defeats itself after overwhelming a blocker', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .withStanding('player1', 'earth', 2)
      .addCard('confident_suitor', 'player1', 'board', { instanceId: 'cs1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['cs1'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ms1', attackerId: 'cs1' },
    });

    // ms1 (1/1) is defeated — overwhelms trigger fires for Confident Suitor
    const ms1 = blockResult.state.cards.find(c => c.instanceId === 'ms1');
    expect(ms1?.zone).toBe('discard');
    expectPlayerMythium(blockResult.state, 'player1', 6);
    const cs1 = blockResult.state.cards.find(c => c.instanceId === 'cs1');
    expect(cs1?.zone).toBe('discard');
  });

  it('gains 6 mythium and defeats itself after breaching', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .withStanding('player1', 'earth', 2)
      .addCard('confident_suitor', 'player1', 'board', { instanceId: 'cs1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['cs1'] },
    });

    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // Breach trigger fires — gain 6 mythium, defeat self
    expectPlayerMythium(passResult.state, 'player1', 6);
    expectCardInZone(passResult.state, 'cs1', 'discard');
  });

  it('does not trigger overwhelms when another card defeats a blocker', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('confident_suitor', 'player1', 'board', { instanceId: 'cs1' })
      .addCard('overwhelming_warrior', 'player1', 'board', { instanceId: 'ow1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ow1'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ms1', attackerId: 'ow1' },
    });

    // OW Warrior's overwhelms fires (choose_mode) — Confident Suitor's should not
    expect(blockResult.waitingFor?.type).toBe('choose_mode');
    const cs1 = blockResult.state.cards.find(c => c.instanceId === 'cs1');
    expect(cs1?.zone).toBe('board');

    const result = processAction(blockResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 }, // OW Warrior: Gain 2 Mythium
    });

    // Only OW Warrior's 2 mythium — Confident Suitor's 6 mythium did not fire
    expectPlayerMythium(result.state, 'player1', 2);
    const cs1After = result.state.cards.find(c => c.instanceId === 'cs1');
    expect(cs1After?.zone).toBe('board');
  });
});
