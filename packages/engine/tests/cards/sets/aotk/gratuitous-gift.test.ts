import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from "../../../../src/cards/test-cards";
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectCardInZone } from '../../../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards()
  registerSetCards();
});

describe('Gratuitous Gift', () => {
  it('creates a choose_card pending choice when a valid follower is in hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('gratuitous_gift', 'player1', 'hand', { instanceId: 'gg1' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gg1' },
    });

    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_card');
    if (result.state.pendingChoice!.type === 'choose_card') {
      expect(result.state.pendingChoice!.costReduction).toBe(2);
    }
  });

  it('choosing a follower plays it at reduced cost (cost-3 follower pays 1)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 2)
      .addCard('gratuitous_gift', 'player1', 'hand', { instanceId: 'gg1' })
      .addCard('void_channeler', 'player1', 'hand', { instanceId: 'vc1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gg1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_card', cardInstanceId: 'vc1' },
    });

    // void_channeler costs 3, reduced by 2 = 1 mythium spent
    expectPlayerMythium(chooseResult.state, 'player1', 4);
    expectCardInZone(chooseResult.state, 'vc1', 'board');
    expect(chooseResult.state.pendingChoice).toBeNull();
  });

  it('cost reduction cannot go below 0 (cost-1 follower pays 0)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('gratuitous_gift', 'player1', 'hand', { instanceId: 'gg1' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gg1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_card', cardInstanceId: 'ms1' },
    });

    // militia_scout costs 1, reduced by 2 = 0 mythium spent
    expectPlayerMythium(chooseResult.state, 'player1', 0);
    expectCardInZone(chooseResult.state, 'ms1', 'board');
  });

  it('follower enters board and its enters abilities resolve', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'earth', 2)
      .addCard('gratuitous_gift', 'player1', 'hand', { instanceId: 'gg1' })
      .addCard('earthshaker_giant', 'player1', 'hand', { instanceId: 'eg1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms_target' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gg1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_card', cardInstanceId: 'eg1' },
    });

    // earthshaker_giant has "Enters: Deal 1 wound to target follower"
    // Giant is now on board too, so 2 valid targets → pending choice for target
    expectCardInZone(chooseResult.state, 'eg1', 'board');
    expect(chooseResult.state.pendingChoice).not.toBeNull();
    expect(chooseResult.state.pendingChoice!.type).toBe('choose_target');
    // Cost: 5 - 2 = 3
    expectPlayerMythium(chooseResult.state, 'player1', 7);

    // Choose the militia_scout as target
    const targetResult = processAction(chooseResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms_target' },
    });

    // militia_scout has 1 health, 1 wound kills it
    expectCardInZone(targetResult.state, 'ms_target', 'discard');
    expect(targetResult.state.pendingChoice).toBeNull();
  });

  it('fizzles gracefully when no valid followers in hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('gratuitous_gift', 'player1', 'hand', { instanceId: 'gg1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gg1' },
    });

    // No followers in hand - fizzles, turn advances
    expect(result.state.pendingChoice).toBeNull();
    expectCardInZone(result.state, 'gg1', 'discard');
    expect(result.state.activePlayer).toBe('player2');
    expect(result.state.actionsTaken).toBe(1);
  });

  it('standing requirements still apply (cannot choose a follower whose standing req is not met)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      // No void standing - void_channeler requires void: 2
      .addCard('gratuitous_gift', 'player1', 'hand', { instanceId: 'gg1' })
      .addCard('void_channeler', 'player1', 'hand', { instanceId: 'vc1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gg1' },
    });

    // void_channeler is the only follower but doesn't meet standing req - fizzles
    expect(result.state.pendingChoice).toBeNull();
    expect(result.state.activePlayer).toBe('player2');
  });

  it('turn advances after the follower is played', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('gratuitous_gift', 'player1', 'hand', { instanceId: 'gg1' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gg1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_card', cardInstanceId: 'ms1' },
    });

    expect(chooseResult.state.activePlayer).toBe('player2');
    expect(chooseResult.state.actionsTaken).toBe(1);
  });

  it('getLegalActions returns valid choose_card actions when pending', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('gratuitous_gift', 'player1', 'hand', { instanceId: 'gg1' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .addCard('void_channeler', 'player1', 'hand', { instanceId: 'vc1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gg1' },
    });

    const legalActions = getLegalActions(playResult.state);
    // militia_scout is valid (cost 1 - 2 = 0, no standing req)
    // void_channeler is NOT valid (no void standing)
    expect(legalActions).toHaveLength(1);
    expect(legalActions[0]).toEqual({
      player: 'player1',
      action: { type: 'choose_card', cardInstanceId: 'ms1' },
    });
  });

  it('rejects choosing a non-follower card', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('gratuitous_gift', 'player1', 'hand', { instanceId: 'gg1' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gg1' },
    });

    // Try to choose the gratuitous_gift event (already in discard, but test the validator)
    expect(() => processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_card', cardInstanceId: 'gg1' },
    })).toThrow('Invalid action');
  });
});
