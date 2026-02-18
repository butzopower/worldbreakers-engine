import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectCardInZone, expectCardCounter } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Amu River Armorer', () => {
  hasPlayCost('amu_river_armorer', 3, { earth: 1 });

  it('enters the board and presents a choose_mode for Migrate', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 1)
      .addCard('amu_river_armorer', 'player1', 'hand', { instanceId: 'ara1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ara1' },
    });

    expectCardInZone(result.state, 'ara1', 'board');
    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_mode');
  });

  it('choosing gain earth standing increases earth standing by 1 and resolves cleanly', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('amu_river_armorer', 'player1', 'hand', { instanceId: 'ara1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ara1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(chooseResult.state.players.player1.standing.earth).toBe(3);
    expectPlayerMythium(chooseResult.state, 'player1', 2); // 5 - 3 cost, no mythium gained
    expect(chooseResult.state.pendingChoice).toBeNull();
    expect(chooseResult.state.activePlayer).toBe('player2');
  });

  it('choosing migrate loses 1 earth standing and gains 3 mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('amu_river_armorer', 'player1', 'hand', { instanceId: 'ara1' })
      .addCard('airag_maker', 'player1', 'board', { instanceId: 'am1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ara1' },
    });

    const migrateResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    expect(migrateResult.state.players.player1.standing.earth).toBe(1); // 2 - 1
    expectPlayerMythium(migrateResult.state, 'player1', 5); // 5 - 3 cost + 3 mythium
  });

  it('after choosing migrate, presents choose_target for the +1/+1 counter', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('amu_river_armorer', 'player1', 'hand', { instanceId: 'ara1' })
      .addCard('airag_maker', 'player1', 'board', { instanceId: 'am1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ara1' },
    });

    const migrateResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    expect(migrateResult.state.pendingChoice).not.toBeNull();
    expect(migrateResult.state.pendingChoice!.type).toBe('choose_target');
  });

  it('chosen follower receives the +1/+1 counter after migrate', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('amu_river_armorer', 'player1', 'hand', { instanceId: 'ara1' })
      .addCard('airag_maker', 'player1', 'board', { instanceId: 'am1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ara1' },
    });

    const migrateResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    const targetResult = processAction(migrateResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'am1' },
    });

    expectCardCounter(targetResult.state, 'am1', 'plus_one_plus_one', 1);
    expect(targetResult.state.pendingChoice).toBeNull();
    expect(targetResult.state.activePlayer).toBe('player2');
  });

  it('can target any follower on the board, including opponent followers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('amu_river_armorer', 'player1', 'hand', { instanceId: 'ara1' })
      .addCard('khutuluns_kheshig', 'player2', 'board', { instanceId: 'kk1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ara1' },
    });

    const migrateResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    const targetResult = processAction(migrateResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'kk1' },
    });

    expectCardCounter(targetResult.state, 'kk1', 'plus_one_plus_one', 1);
  });

  it('can target itself with the +1/+1 counter', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('amu_river_armorer', 'player1', 'hand', { instanceId: 'ara1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ara1' },
    });

    const migrateResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    // ara1 is now on the board and is a valid target
    const targetResult = processAction(migrateResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ara1' },
    });

    expectCardCounter(targetResult.state, 'ara1', 'plus_one_plus_one', 1);
  });
});
