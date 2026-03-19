import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone, expectCardCounter } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Pernicious Powder', () => {
  hasPlayCost('pernicious_powder', 4, { void: 3 });

  it('deals 2 wounds to 3 different followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 4)
      .withStanding('player1', 'void', 3)
      .addCard('pernicious_powder', 'player1', 'hand', { instanceId: 'pp1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' }) // 1/3
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb2' }) // 1/3
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb3' }) // 1/3
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pp1' },
    });

    // First optional: choose to deal wounds
    expect(playResult.waitingFor?.type).toBe('choose_mode');
    const choice1 = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // Choose first target
    const target1 = processAction(choice1.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    // Second optional: choose to deal wounds
    expect(target1.waitingFor?.type).toBe('choose_mode');
    const choice2 = processAction(target1.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // Choose second target
    const target2 = processAction(choice2.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb2' },
    });

    // Third optional: choose to deal wounds
    expect(target2.waitingFor?.type).toBe('choose_mode');
    const choice3 = processAction(target2.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // Choose third target
    const result = processAction(choice3.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb3' },
    });

    expectCardCounter(result.state, 'sb1', 'wound', 2);
    expectCardCounter(result.state, 'sb2', 'wound', 2);
    expectCardCounter(result.state, 'sb3', 'wound', 2);
    expectCardInZone(result.state, 'pp1', 'discard');
  });

  it('can pass on any of the wound effects', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 4)
      .withStanding('player1', 'void', 3)
      .addCard('pernicious_powder', 'player1', 'hand', { instanceId: 'pp1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' }) // 1/3
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb2' }) // 1/3
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pp1' },
    });

    // First optional: choose to deal wounds
    const choice1 = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    const target1 = processAction(choice1.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'sb1' },
    });

    // Second optional: pass
    const result = processAction(target1.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 }, // Pass
    });

    // Only sb1 should have wounds
    expectCardCounter(result.state, 'sb1', 'wound', 2);
    expectCardCounter(result.state, 'sb2', 'wound', 0);
  });

  it('can pass on all wound effects', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 4)
      .withStanding('player1', 'void', 3)
      .addCard('pernicious_powder', 'player1', 'hand', { instanceId: 'pp1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'pp1' },
    });

    // Pass all three times
    const pass1 = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    const pass2 = processAction(pass1.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    const result = processAction(pass2.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    expectCardCounter(result.state, 'sb1', 'wound', 0);
    expectCardInZone(result.state, 'pp1', 'discard');
  });
});
