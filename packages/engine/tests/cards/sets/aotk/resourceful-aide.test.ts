import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium } from '../../../helpers/assertions.js';
import { autoAccept } from '../../../helpers/game';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Resourceful Aide', () => {
  hasPlayCost('resourceful_aide', 3, { void: 1 });

  it('gains 2 mythium when a follower attacks alone', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('resourceful_aide', 'player1', 'board', { instanceId: 'ra1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .build();

    // Attack with 1 follower — triggers first_solo_attack_this_round + your_attack (stone_sentinel)
    const result = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    }));

    // Resourceful Aide should have granted 2 mythium
    expectPlayerMythium(result.state, 'player1', 2);
  });

  it('does not trigger when multiple followers attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('resourceful_aide', 'player1', 'board', { instanceId: 'ra1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk2' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1', 'atk2'] },
    });

    // No solo attack trigger, mythium unchanged
    expectPlayerMythium(result.state, 'player1', 0);
  });

  it('does not trigger on the second solo attack in the same round', () => {
    // Simulate that a solo attack already happened this round
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('resourceful_aide', 'player1', 'board', { instanceId: 'ra1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .build();

    // Set soloAttackedThisRound to true (simulating a prior solo attack)
    const stateWithPriorAttack = {
      ...state,
      players: {
        ...state.players,
        player1: { ...state.players.player1, soloAttackedThisRound: true },
      },
    };

    const result = processAction(stateWithPriorAttack, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // Should not gain mythium — not the first solo attack
    expectPlayerMythium(result.state, 'player1', 0);
  });

  it('does not trigger if played after a solo attack already happened this round', () => {
    // The card is on the board but a solo attack already occurred before it was played
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('resourceful_aide', 'player1', 'board', { instanceId: 'ra1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .build();

    const stateWithPriorAttack = {
      ...state,
      players: {
        ...state.players,
        player1: { ...state.players.player1, soloAttackedThisRound: true },
      },
    };

    const result = processAction(stateWithPriorAttack, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    expectPlayerMythium(result.state, 'player1', 0);
  });
});
