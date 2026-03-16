import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { hasPlayCost } from '../../../helpers/properties';
import { autoAccept } from '../../../helpers/game';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Blind Sculptor', () => {
  hasPlayCost('the_blind_sculptor', 4, { stars: 3 });

  it('rally trigger develops a location you control', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withFirstPlayer('player1')
      .withActionsTaken(7)
      .withStanding('player1', 'stars', 3)
      .addCard('the_blind_sculptor', 'player1', 'board', { instanceId: 'bs1' })
      .addCard('illicit_bazaar', 'player1', 'board', { instanceId: 'ib1', counters: { stage: 3 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .addCard('militia_scout', 'player2', 'deck', { instanceId: 'deck2' })
      .build();

    // Take last action to trigger rally
    const rallyResult = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'gain_mythium' },
    }));

    // Should prompt to choose a location to develop
    expect(rallyResult.waitingFor?.type).toBe('choose_target');

    // Choose the bazaar
    const devResult = processAction(rallyResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ib1' },
    });

    // Bazaar developed: stage 3 -> 2, stage I ability fires (gain 2 mythium + choose standing)
    const bazaar = devResult.state.cards.find(c => c.instanceId === 'ib1')!;
    expect(bazaar.counters.stage).toBe(2);
  });

  it('rally trigger can be skipped', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withFirstPlayer('player1')
      .withActionsTaken(7)
      .withStanding('player1', 'stars', 3)
      .addCard('the_blind_sculptor', 'player1', 'board', { instanceId: 'bs1' })
      .addCard('illicit_bazaar', 'player1', 'board', { instanceId: 'ib1', counters: { stage: 3 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .addCard('militia_scout', 'player2', 'deck', { instanceId: 'deck2' })
      .build();

    // Take last action to trigger rally
    const rallyResult = processAction(state, {
      player: 'player1',
      action: { type: 'gain_mythium' },
    });

    // Non-forced trigger — choose_trigger_order prompt, skip it
    expect(rallyResult.waitingFor?.type).toBe('choose_trigger_order');

    const skipResult = processAction(rallyResult.state, {
      player: 'player1',
      action: { type: 'skip_trigger', triggerIndex: 0 },
    });

    // Bazaar should not have been developed
    const bazaar = skipResult.state.cards.find(c => c.instanceId === 'ib1')!;
    expect(bazaar.counters.stage).toBe(3);
  });
});
