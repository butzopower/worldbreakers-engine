import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone, expectCardCounter, expectPlayerPower, expectPlayerMythium } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe("Raider's Hideaway", () => {
  hasPlayCost('raiders_hideaway', 5, { void: 2 });

  it('stage I: gains 2 mythium and 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('raiders_hideaway', 'player1', 'board', { instanceId: 'rh1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'rh1' },
    });

    expectCardCounter(result.state, 'rh1', 'stage', 2);
    expectPlayerMythium(result.state, 'player1', 2);
    expectPlayerPower(result.state, 'player1', 1);
  });

  it('stage II: gains 2 mythium and allows attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('raiders_hideaway', 'player1', 'board', { instanceId: 'rh1', counters: { stage: 2 } })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'rh1' },
    });

    // Should gain 2 mythium
    expectPlayerMythium(result.state, 'player1', 2);

    // Should be waiting for attacker selection (initiate_attack)
    expect(result.waitingFor?.type).toBe('choose_attackers');
  });

  it('stage III: gains 2 mythium and 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('raiders_hideaway', 'player1', 'board', { instanceId: 'rh1', counters: { stage: 1 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'rh1' },
    });

    expectPlayerMythium(result.state, 'player1', 2);
    expectPlayerPower(result.state, 'player1', 1);
    expectCardInZone(result.state, 'rh1', 'discard');
  });
});
