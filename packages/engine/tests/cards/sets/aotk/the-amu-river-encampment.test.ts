import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardCounter, expectCardInZone, expectPlayerPower } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Amu River Encampment', () => {
  hasPlayCost('the_amu_river_encampment', 2, { earth: 3 });

  it('enters: initiates an attack when played with an attackable follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .withStanding('player1', 'earth', 3)
      .addCard('the_amu_river_encampment', 'player1', 'hand', { instanceId: 'enc1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'enc1' },
    });

    expect(result.waitingFor?.type).toBe('choose_attackers');
  });

  it('stage I: developing gains 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_amu_river_encampment', 'player1', 'board', { instanceId: 'enc1', counters: { stage: 2 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'enc1' },
    });

    expectPlayerPower(result.state, 'player1', 1);
  });

  it('stage I: prompts to put a +1/+1 counter on a follower when one is present', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_amu_river_encampment', 'player1', 'board', { instanceId: 'enc1', counters: { stage: 2 } })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'enc1' },
    });

    expect(result.waitingFor?.type).toBe('choose_target');

    const afterCounter = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectCardCounter(afterCounter.state, 'ms1', 'plus_one_plus_one', 1);
  });

  it('stage II: all followers gain overwhelm and the location depletes', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_amu_river_encampment', 'player1', 'board', { instanceId: 'enc1', counters: { stage: 1 } })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' }) // 1/1
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'blk1' }) // 1/1
      .build();

    // Develop triggers stage II: grant overwhelm to all followers, initiate attack
    const devResult = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'enc1' },
    });

    // Location should be depleted to discard
    expectCardInZone(devResult.state, 'enc1', 'discard');

    // Choose attackers
    const attackResult = processAction(devResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['atk1'] },
    });

    // Declare blocker — atk1 (1 str) defeats blk1 (1 health), overwhelm fires → 1 power
    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'blk1', attackerId: 'atk1' },
    });

    expectPlayerPower(blockResult.state, 'player1', 1);
  });

  it('stage II: overwhelm expires after combat ends', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_amu_river_encampment', 'player1', 'board', { instanceId: 'enc1', counters: { stage: 1 } })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' }) // 1/1
      .build();

    const devResult = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'enc1' },
    });

    const attackResult = processAction(devResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });

    // Pass block — no blockers, no opponent locations, combat ends automatically
    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // After combat, overwhelm lasting effect should be gone
    expect(passResult.state.lastingEffects.filter(e => e.type === 'overwhelm')).toHaveLength(0);
  });
});
