import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';
import { autoAccept } from '../../../helpers/game';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Weaving Workshop', () => {
  hasPlayCost('weaving_workshop', 4, { stars: 2 });

  it('enters ability lets you play a location card paying 2 less', () => {
    // the_humble_underpass costs 2, with 2 discount = 0
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 2)
      .withMythium('player1', 10)
      .addCard('weaving_workshop', 'player1', 'hand', { instanceId: 'ww1' })
      .addCard('the_humble_underpass', 'player1', 'hand', { instanceId: 'loc1' })
      .build();

    // Play weaving workshop — accept the enters trigger
    const playResult = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ww1' },
    }));

    // Select the location to play
    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'loc1' },
    });

    expectCardInZone(result.state, 'ww1', 'board');
    expectCardInZone(result.state, 'loc1', 'board');
    // Started with 10, paid 4 for workshop, 0 for underpass (2 - 2 discount = 0)
    expect(result.state.players.player1.mythium).toBe(6);
  });

  it('stage I grants 2 mythium, 1 power, and develops another location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 2)
      .withMythium('player1', 10)
      .addCard('weaving_workshop', 'player1', 'board', { instanceId: 'ww1', counters: { stage: 2 } })
      .addCard('the_humble_underpass', 'player1', 'board', { instanceId: 'loc1', counters: { stage: 2 } })
      .build();

    // Develop the workshop (stage 1)
    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ww1' },
    });

    // Stage I ability should prompt to choose a location to develop
    expect(result.waitingFor?.type).toBe('choose_target');

    // Choose the other location
    const devResult = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'loc1' },
    });

    // Workshop: 2 -> 1 stage, underpass: 2 -> 1 stage
    const ww = devResult.state.cards.find(c => c.instanceId === 'ww1')!;
    const loc = devResult.state.cards.find(c => c.instanceId === 'loc1')!;
    expect(ww.counters.stage).toBe(1);
    expect(loc.counters.stage).toBe(1);

    // Gained 2 mythium (workshop I) + 2 mythium (underpass I) and 1 power (workshop I) + 1 power (underpass I)
    expect(devResult.state.players.player1.mythium).toBe(14);
    expect(devResult.state.players.player1.power).toBe(2);
  });

  it('develop cannot target itself', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 2)
      .withMythium('player1', 10)
      .addCard('weaving_workshop', 'player1', 'board', { instanceId: 'ww1', counters: { stage: 2 } })
      .build();

    // Develop the workshop with no other locations — develop effect should be skipped
    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ww1' },
    });

    // No target prompt since there are no valid develop targets (only itself, excluded)
    expect(result.state.pendingChoice).toBeNull();
    // Still got the mythium and power from stage I
    expect(result.state.players.player1.mythium).toBe(12);
    expect(result.state.players.player1.power).toBe(1);
  });

  it('stage II grants 1 power and develops another location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'stars', 2)
      .withMythium('player1', 10)
      .addCard('weaving_workshop', 'player1', 'board', { instanceId: 'ww1', counters: { stage: 1 } })
      .addCard('the_humble_underpass', 'player1', 'board', { instanceId: 'loc1', counters: { stage: 2 } })
      .build();

    // Develop the workshop (stage 2 — last stage, depletes)
    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'ww1' },
    });

    // Stage II ability should prompt to choose a location to develop
    expect(result.waitingFor?.type).toBe('choose_target');

    const devResult = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'loc1' },
    });

    // Workshop depleted (moved to discard), underpass: 2 -> 1 stage
    expectCardInZone(devResult.state, 'ww1', 'discard');
    const loc = devResult.state.cards.find(c => c.instanceId === 'loc1')!;
    expect(loc.counters.stage).toBe(1);

    // Gained 1 power (workshop II) + 2 mythium + 1 power (underpass I)
    expect(devResult.state.players.player1.power).toBe(2);
    expect(devResult.state.players.player1.mythium).toBe(12);
  });
});
