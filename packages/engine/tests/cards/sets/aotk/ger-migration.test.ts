import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectHandSize, expectPlayerMythium } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Ger Migration', () => {
  hasPlayCost('ger_migration', 1, { earth: 1 });

  it('presents choose_mode with two options on play', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withMythium('player1', 1)
      .addCard('ger_migration', 'player1', 'hand', { instanceId: 'gm1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms2' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gm1' },
    });

    expect(result.waitingFor?.type).toBe('choose_mode');
  });

  it('mode 0: gains 1 standing with the chosen guild after drawing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 1)
      .withStanding('player1', 'moon', 0)
      .withMythium('player1', 1)
      .addCard('ger_migration', 'player1', 'hand', { instanceId: 'gm1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms2' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gm1' },
    });

    const drawResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    // Choose Moon standing (modeIndex corresponds to STANDING_GUILDS order)
    const moonModeIndex = drawResult.state.pendingChoice!.type === 'choose_mode'
      ? drawResult.state.pendingChoice!.modes.findIndex(m => m.label.toLowerCase().includes('moon'))
      : -1;

    const result = processAction(drawResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: moonModeIndex },
    });

    expect(result.state.players.player1.standing.moon).toBe(1);
  });

  it('mode 1: spends 1 earth standing and gains 5 mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 2)
      .withMythium('player1', 1)
      .addCard('ger_migration', 'player1', 'hand', { instanceId: 'gm1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'gm1' },
    });

    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    // Started with 2 earth, spent 1 → 1 remaining
    expect(result.state.players.player1.standing.earth).toBe(1);
    // Started with 1 mythium (paid for card), spent mode gives 5 → 5 total
    expectPlayerMythium(result.state, 'player1', 5);
  });
});
