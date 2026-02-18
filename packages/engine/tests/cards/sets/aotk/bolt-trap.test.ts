import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Bolt Trap', () => {
  hasPlayCost('bolt_trap', 2, { moon: 1 });

  it('presents choose_target for a follower with cost 3 or less', () => {
    // militia_scout costs 1, shield_bearer costs 2, void_channeler costs 3
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'moon', 1)
      .addCard('bolt_trap', 'player1', 'hand', { instanceId: 'bt1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bt1' },
    });

    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_target');
  });

  it('defeats the chosen follower — moves it to discard', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'moon', 1)
      .addCard('bolt_trap', 'player1', 'hand', { instanceId: 'bt1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bt1' },
    });

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectCardInZone(targetResult.state, 'ms1', 'discard');
    expect(targetResult.state.pendingChoice).toBeNull();
    expect(targetResult.state.activePlayer).toBe('player2');
  });

  it('can target a follower with cost exactly 3', () => {
    // void_channeler costs 3
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'moon', 1)
      .addCard('bolt_trap', 'player1', 'hand', { instanceId: 'bt1' })
      .addCard('void_channeler', 'player2', 'board', { instanceId: 'vc1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bt1' },
    });

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'vc1' },
    });

    expectCardInZone(targetResult.state, 'vc1', 'discard');
  });

  it('cannot target a follower with cost 4 or more', () => {
    // earthshaker_giant costs 5 — too expensive to target
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'moon', 1)
      .addCard('bolt_trap', 'player1', 'hand', { instanceId: 'bt1' })
      .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'eg1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bt1' },
    });

    // No valid targets — effect skipped, turn advances
    expect(result.state.pendingChoice).toBeNull();
    expect(result.state.activePlayer).toBe('player2');
    expectCardInZone(result.state, 'eg1', 'board');
  });

  it('can target your own followers as well as the opponent\'s', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'moon', 1)
      .addCard('bolt_trap', 'player1', 'hand', { instanceId: 'bt1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bt1' },
    });

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectCardInZone(targetResult.state, 'ms1', 'discard');
  });

  it('with mixed-cost followers, only those with cost <= 3 are valid targets', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'moon', 1)
      .addCard('bolt_trap', 'player1', 'hand', { instanceId: 'bt1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })   // cost 1 — valid
      .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'eg1' }) // cost 5 — invalid
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'bt1' },
    });

    // A target choice is presented (militia_scout is valid)
    expect(playResult.state.pendingChoice!.type).toBe('choose_target');

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectCardInZone(targetResult.state, 'ms1', 'discard');
    expectCardInZone(targetResult.state, 'eg1', 'board');
  });
});
