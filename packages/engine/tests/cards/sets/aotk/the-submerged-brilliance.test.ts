import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectPlayerPower, expectHandSize, expectCardInZone, expectCardCounter } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Submerged Brilliance', () => {
  it('costs 3 mythium to play and enters with 3 stage counters', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('the_submerged_brilliance', 'player1', 'hand', { instanceId: 'sb1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sb1' },
    });

    expectCardInZone(result.state, 'sb1', 'board');
    expectCardCounter(result.state, 'sb1', 'stage', 3);
    expectPlayerMythium(result.state, 'player1', 0);
  });

  it('stage I: developing draws 2 cards and gains 2 mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_submerged_brilliance', 'player1', 'board', { instanceId: 'sb1', counters: { stage: 3 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck2' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'sb1' },
    });

    expectCardCounter(result.state, 'sb1', 'stage', 2);
    expectHandSize(result.state, 'player1', 2);
    expectPlayerMythium(result.state, 'player1', 2);
  });

  it('stage II: developing gains 1 power and presents guild choice', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_submerged_brilliance', 'player1', 'board', { instanceId: 'sb1', counters: { stage: 2 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'sb1' },
    });

    expectCardCounter(result.state, 'sb1', 'stage', 1);
    expectPlayerPower(result.state, 'player1', 1);
    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_mode');
    if (result.state.pendingChoice!.type === 'choose_mode') {
      expect(result.state.pendingChoice!.modes).toHaveLength(4);
    }
  });

  it('stage II: choosing Void gains 1 void standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_submerged_brilliance', 'player1', 'board', { instanceId: 'sb1', counters: { stage: 2 } })
      .build();

    const developResult = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'sb1' },
    });

    const chooseResult = processAction(developResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 2 },
    });

    expectPlayerPower(chooseResult.state, 'player1', 1);
    expect(chooseResult.state.players.player1.standing.void).toBe(1);
    expect(chooseResult.state.pendingChoice).toBeNull();
  });

  it('stage III: developing gains 1 power and depletes the location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_submerged_brilliance', 'player1', 'board', { instanceId: 'sb1', counters: { stage: 1 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'sb1' },
    });

    expectPlayerPower(result.state, 'player1', 1);
    expectCardInZone(result.state, 'sb1', 'discard');
  });
});
