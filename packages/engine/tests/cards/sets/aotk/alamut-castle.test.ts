import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone, expectCardCounter, expectPlayerPower } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Alamut Castle', () => {
  hasPlayCost('alamut_castle', 7, { void: 2 });

  it('enters with 3 stage counters', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 7)
      .withStanding('player1', 'void', 2)
      .addCard('alamut_castle', 'player1', 'hand', { instanceId: 'ac1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ac1' },
    });

    expectCardInZone(result.state, 'ac1', 'board');
    expectCardCounter(result.state, 'ac1', 'stage', 3);
  });

  it('stage I: developing gains 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('alamut_castle', 'player1', 'board', { instanceId: 'ac1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ac1' },
    });

    expectCardCounter(result.state, 'ac1', 'stage', 2);
    expectPlayerPower(result.state, 'player1', 1);
  });

  it('stage II: developing gains 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('alamut_castle', 'player1', 'board', { instanceId: 'ac1', counters: { stage: 2 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ac1' },
    });

    expectCardCounter(result.state, 'ac1', 'stage', 1);
    expectPlayerPower(result.state, 'player1', 1);
  });

  it('stage III: developing gains 2 power and depletes the location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('alamut_castle', 'player1', 'board', { instanceId: 'ac1', counters: { stage: 1 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ac1' },
    });

    expectPlayerPower(result.state, 'player1', 2);
    expectCardInZone(result.state, 'ac1', 'discard');
  });

  it('your_attack with 1 attacker: readies worldbreaker and develops Alamut Castle', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('alamut_castle', 'player1', 'board', { instanceId: 'ac1', counters: { stage: 3 } })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1', exhausted: true })
      .addCard('airag_maker', 'player1', 'board', { instanceId: 'am1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['am1'] },
    });

    // Worldbreaker should be readied
    const wb = result.state.cards.find(c => c.instanceId === 'wb1');
    expect(wb!.exhausted).toBe(false);

    // Alamut Castle should have been developed (stage 3 -> 2)
    expectCardCounter(result.state, 'ac1', 'stage', 2);

    // Stage I develop grants 1 power
    expectPlayerPower(result.state, 'player1', 1);
  });

  it('your_attack with 2+ attackers: does NOT trigger', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('alamut_castle', 'player1', 'board', { instanceId: 'ac1', counters: { stage: 3 } })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1', exhausted: true })
      .addCard('airag_maker', 'player1', 'board', { instanceId: 'am1' })
      .addCard('earth_apprentice', 'player1', 'board', { instanceId: 'ea1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['am1', 'ea1'] },
    });

    // Worldbreaker should still be exhausted
    const wb = result.state.cards.find(c => c.instanceId === 'wb1');
    expect(wb!.exhausted).toBe(true);

    // Alamut Castle should NOT have been developed
    expectCardCounter(result.state, 'ac1', 'stage', 3);
  });

  it('your_attack when Alamut Castle is depleted: develop is a no-op', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('alamut_castle', 'player1', 'board', { instanceId: 'ac1', counters: { stage: 1 } })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1', exhausted: true })
      .addCard('airag_maker', 'player1', 'board', { instanceId: 'am1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['am1'] },
    });

    // Worldbreaker should be readied
    const wb = result.state.cards.find(c => c.instanceId === 'wb1');
    expect(wb!.exhausted).toBe(false);

    // Alamut Castle developed its last stage (stage 1 -> depleted -> discard)
    expectCardInZone(result.state, 'ac1', 'discard');

    // Stage III develop grants 2 power
    expectPlayerPower(result.state, 'player1', 2);
  });
});
