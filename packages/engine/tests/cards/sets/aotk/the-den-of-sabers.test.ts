import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectPlayerPower, expectHandSize, expectCardInZone, expectCardCounter } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Den of Sabers', () => {
  it('costs 4 mythium to play and enters with 3 stage counters', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 4)
      .addCard('the_den_of_sabers', 'player1', 'hand', { instanceId: 'dos1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'dos1' },
    });

    expectCardInZone(result.state, 'dos1', 'board');
    expectCardCounter(result.state, 'dos1', 'stage', 3);
    expectPlayerMythium(result.state, 'player1', 0);
  });

  it('stage I: developing gains 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_den_of_sabers', 'player1', 'board', { instanceId: 'dos1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'dos1' },
    });

    expectCardCounter(result.state, 'dos1', 'stage', 2);
    expectPlayerPower(result.state, 'player1', 1);
  });

  it('stage II: draws 1 card first, then presents guild choice', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_den_of_sabers', 'player1', 'board', { instanceId: 'dos1', counters: { stage: 2 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'dos1' },
    });

    expectCardCounter(result.state, 'dos1', 'stage', 1);
    // Card is drawn before the mode choice is presented
    expectHandSize(result.state, 'player1', 1);
    expectCardInZone(result.state, 'deck1', 'hand');
    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_mode');
    if (result.state.pendingChoice!.type === 'choose_mode') {
      expect(result.state.pendingChoice!.modes).toHaveLength(4);
    }
  });

  it('stage II: choosing Earth gains 1 earth standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_den_of_sabers', 'player1', 'board', { instanceId: 'dos1', counters: { stage: 2 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const developResult = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'dos1' },
    });

    const chooseResult = processAction(developResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expectHandSize(chooseResult.state, 'player1', 1);
    expect(chooseResult.state.players.player1.standing.earth).toBe(1);
    expect(chooseResult.state.pendingChoice).toBeNull();
  });

  it('stage II: choosing Moon gains 1 moon standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_den_of_sabers', 'player1', 'board', { instanceId: 'dos1', counters: { stage: 2 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    const developResult = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'dos1' },
    });

    const chooseResult = processAction(developResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    expectHandSize(chooseResult.state, 'player1', 1);
    expect(chooseResult.state.players.player1.standing.moon).toBe(1);
  });

  it('stage III: developing gains 2 power and depletes the location', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('the_den_of_sabers', 'player1', 'board', { instanceId: 'dos1', counters: { stage: 1 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'dos1' },
    });

    expectPlayerPower(result.state, 'player1', 2);
    expectCardInZone(result.state, 'dos1', 'discard');
  });

  it('has no standing requirement', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 4)
      // No standing at all
      .addCard('the_den_of_sabers', 'player1', 'hand', { instanceId: 'dos1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'dos1' },
    });

    expectCardInZone(result.state, 'dos1', 'board');
  });
});
