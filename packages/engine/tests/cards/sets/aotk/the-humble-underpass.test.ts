import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectPlayerPower, expectCardInZone, expectCardCounter } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Humble Underpass', () => {
  it('costs 2 mythium to play and enters with 2 stage counters', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 2)
      .addCard('the_humble_underpass', 'player1', 'hand', { instanceId: 'hu1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'hu1' },
    });

    expectCardInZone(result.state, 'hu1', 'board');
    expectCardCounter(result.state, 'hu1', 'stage', 2);
    expectPlayerMythium(result.state, 'player1', 0);
  });

  it('stage I: developing gains 2 mythium and 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_humble_underpass', 'player1', 'board', { instanceId: 'hu1', counters: { stage: 2 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'hu1' },
    });

    expectCardCounter(result.state, 'hu1', 'stage', 1);
    expectPlayerMythium(result.state, 'player1', 2);
    expectPlayerPower(result.state, 'player1', 1);
  });

  it('stage II: developing gains 2 mythium and presents guild choice', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_humble_underpass', 'player1', 'board', { instanceId: 'hu1', counters: { stage: 1 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'hu1' },
    });

    expectPlayerMythium(result.state, 'player1', 2);
    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_mode');
    if (result.state.pendingChoice!.type === 'choose_mode') {
      expect(result.state.pendingChoice!.modes).toHaveLength(4);
    }
  });

  it('stage II: choosing Stars gains 1 stars standing and depletes', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_humble_underpass', 'player1', 'board', { instanceId: 'hu1', counters: { stage: 1 } })
      .build();

    const developResult = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'hu1' },
    });

    const chooseResult = processAction(developResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 3 },
    });

    expectPlayerMythium(chooseResult.state, 'player1', 2);
    expect(chooseResult.state.players.player1.standing.stars).toBe(1);
    expect(chooseResult.state.pendingChoice).toBeNull();
    expectCardInZone(chooseResult.state, 'hu1', 'discard');
  });

  it('stage II: choosing Earth gains 1 earth standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_humble_underpass', 'player1', 'board', { instanceId: 'hu1', counters: { stage: 1 } })
      .build();

    const developResult = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'hu1' },
    });

    const chooseResult = processAction(developResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(chooseResult.state.players.player1.standing.earth).toBe(1);
    expectCardInZone(chooseResult.state, 'hu1', 'discard');
  });
});
