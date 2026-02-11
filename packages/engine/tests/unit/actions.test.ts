import { describe, it, expect, beforeEach } from 'vitest';
import { registerTestCards } from '../../src/cards/test-cards/index.js';
import { clearRegistry } from '../../src/cards/registry.js';
import { processAction } from '../../src/engine/engine.js';
import { buildState } from '../helpers/state-builder.js';
import { expectPlayerMythium, expectPlayerPower, expectHandSize, expectCardInZone, expectCardCounter, expectEvent } from '../helpers/assertions.js';
import { getCard, getHand } from '../../src/state/query.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
});

describe('gain_mythium action', () => {
  it('gives 1 mythium to active player and advances turn', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'gain_mythium' },
    });

    expectPlayerMythium(result.state, 'player1', 1);
    expect(result.state.activePlayer).toBe('player2');
    expect(result.state.actionsTaken).toBe(1);
  });
});

describe('draw_card action', () => {
  it('draws a card from deck to hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'ms1' })
      .addCard('shield_bearer', 'player1', 'deck', { instanceId: 'sb1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'draw_card' },
    });

    expectCardInZone(result.state, 'ms1', 'hand');
    expectHandSize(result.state, 'player1', 1);
  });

  it('does nothing when deck is empty (no power gain)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'draw_card' },
    });

    expectPlayerPower(result.state, 'player1', 0);
    expectPlayerPower(result.state, 'player2', 0);
  });
});

describe('buy_standing action', () => {
  it('spends 2 mythium to gain 1 standing', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 3)
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'buy_standing', guild: 'earth' },
    });

    expectPlayerMythium(result.state, 'player1', 1);
    expect(result.state.players.player1.standing.earth).toBe(1);
  });

  it('rejects when not enough mythium', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 1)
      .build();

    expect(() => processAction(state, {
      player: 'player1',
      action: { type: 'buy_standing', guild: 'earth' },
    })).toThrow('Invalid action');
  });
});

describe('play_card action', () => {
  it('plays a follower to the board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ms1' },
    });

    expectCardInZone(result.state, 'ms1', 'board');
    expectPlayerMythium(result.state, 'player1', 4); // cost 1
    expectEvent(result.events, 'card_played');
  });

  it('plays a location with stage counters', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 1)
      .addCard('watchtower', 'player1', 'hand', { instanceId: 'wt1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'wt1' },
    });

    expectCardInZone(result.state, 'wt1', 'board');
    expectCardCounter(result.state, 'wt1', 'stage', 3);
    expectPlayerMythium(result.state, 'player1', 3); // cost 2
  });

  it('plays an event card to discard', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 1)
      .addCard('mother_lode', 'player1', 'hand', { instanceId: 'ml1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ml1' },
    });

    // Event goes to discard
    expectCardInZone(result.state, 'ml1', 'discard');
  });

  it('rejects playing card you cannot afford', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .build();

    expect(() => processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ms1' },
    })).toThrow('Invalid action');
  });
});

describe('develop action', () => {
  it('removes a stage counter and resolves stage ability', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('watchtower', 'player1', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'wt1' },
    });

    expectCardCounter(result.state, 'wt1', 'stage', 2);
    // Stage 1 ability: gain 1 mythium
    expectPlayerMythium(result.state, 'player1', 1);
  });

  it('depletes location when last stage counter removed', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('watchtower', 'player1', 'board', { instanceId: 'wt1', counters: { stage: 1 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'wt1' },
    });

    // Location should be depleted and discarded
    expectCardInZone(result.state, 'wt1', 'discard');
    expectEvent(result.events, 'location_depleted');
  });
});

describe('use_ability action', () => {
  it('resolves action ability on follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('void_channeler', 'player1', 'board', { instanceId: 'vc1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'use_ability', cardInstanceId: 'vc1', abilityIndex: 0 },
    });

    // Void Channeler: Action: Gain 1 power
    expectPlayerPower(result.state, 'player1', 1);
    // Should be exhausted after use
    const card = getCard(result.state, 'vc1')!;
    expect(card.exhausted).toBe(true);
  });

  it('rejects using ability on exhausted follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('void_channeler', 'player1', 'board', { instanceId: 'vc1', exhausted: true })
      .build();

    expect(() => processAction(state, {
      player: 'player1',
      action: { type: 'use_ability', cardInstanceId: 'vc1', abilityIndex: 0 },
    })).toThrow('Invalid action');
  });
});

describe('turn alternation', () => {
  it('alternates players each action', () => {
    let state = buildState()
      .withActivePlayer('player1')
      .withFirstPlayer('player1')
      .build();

    const result1 = processAction(state, {
      player: 'player1',
      action: { type: 'gain_mythium' },
    });
    expect(result1.state.activePlayer).toBe('player2');

    const result2 = processAction(result1.state, {
      player: 'player2',
      action: { type: 'gain_mythium' },
    });
    expect(result2.state.activePlayer).toBe('player1');
  });

  it('rejects actions from non-active player', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .build();

    expect(() => processAction(state, {
      player: 'player2',
      action: { type: 'gain_mythium' },
    })).toThrow('Invalid action');
  });
});
