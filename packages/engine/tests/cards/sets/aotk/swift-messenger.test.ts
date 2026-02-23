import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Swift Messenger', () => {
  hasPlayCost('swift_messenger', 3);

  it('presents a guild choice on enter', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('swift_messenger', 'player1', 'hand', { instanceId: 'sm1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sm1' },
    });

    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_mode');
    if (result.state.pendingChoice!.type === 'choose_mode') {
      expect(result.state.pendingChoice!.modes).toHaveLength(4);
    }
  });

  it('choosing Earth gains 1 earth standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .addCard('swift_messenger', 'player1', 'hand', { instanceId: 'sm1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'sm1' },
    });

    const chooseResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(chooseResult.state.players.player1.standing.earth).toBe(1);
    expect(chooseResult.state.pendingChoice).toBeNull();
  });
});
