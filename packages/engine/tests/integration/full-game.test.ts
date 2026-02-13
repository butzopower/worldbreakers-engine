import { describe, it, expect, beforeEach } from 'vitest';
import { registerTestCards } from '../../src/cards/test-cards/index.js';
import { clearRegistry } from '../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../src/engine/engine.js';
import { buildState } from '../helpers/state-builder.js';
import { expectPlayerMythium, expectPlayerPower } from '../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
});

describe('full round - 8 actions + rally', () => {
  it('completes a full round of 8 alternating actions then rally', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withFirstPlayer('player1')
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'p1d1' })
      .addCard('militia_scout', 'player2', 'deck', { instanceId: 'p2d1' })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    let s = state;

    // 8 actions: each player gains mythium 4 times
    for (let i = 0; i < 8; i++) {
      const player = i % 2 === 0 ? 'player1' : 'player2';
      const result = processAction(s, {
        player: player as 'player1' | 'player2',
        action: { type: 'gain_mythium' },
      });
      s = result.state;
    }

    // After 8 actions, rally should have occurred
    // Rally gives: 2 mythium each, 1 card draw each, then new round
    expect(s.round).toBe(2);
    expect(s.actionsTaken).toBe(0);
    // First player alternates: was player1, now player2
    expect(s.firstPlayer).toBe('player2');
    expect(s.activePlayer).toBe('player2');

    // Mythium: 4 from actions + 2 from rally = 6
    expectPlayerMythium(s, 'player1', 6);
    expectPlayerMythium(s, 'player2', 6);
  });
});

describe('victory conditions', () => {
  it('declares winner when player reaches 10 power during rally', () => {
    const state = buildState()
      .withActivePlayer('player2')
      .withFirstPlayer('player1')
      .withPower('player1', 10)
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .withActionsTaken(7) // One action away from rally
      .build();

    // Action 8 is player2's turn (0-indexed: 0=p1, 1=p2, ..., 7=p2)
    // But activePlayer alternates: with 7 taken, next is p2 (odd index)
    // firstPlayer=p1, so turns go p1,p2,p1,p2... action 7 (8th) is p2
    const result = processAction(state, {
      player: 'player2',
      action: { type: 'gain_mythium' },
    });

    expect(result.state.phase).toBe('gameOver');
    expect(result.state.winner).toBe('player1');
  });

  it('declares draw when both players tied at 10+', () => {
    const state = buildState()
      .withActivePlayer('player2')
      .withFirstPlayer('player1')
      .withPower('player1', 10)
      .withPower('player2', 10)
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .withActionsTaken(7)
      .build();

    const result = processAction(state, {
      player: 'player2',
      action: { type: 'gain_mythium' },
    });

    expect(result.state.phase).toBe('gameOver');
    expect(result.state.winner).toBe('draw');
  });

  it('higher power wins when both at 10+', () => {
    const state = buildState()
      .withActivePlayer('player2')
      .withFirstPlayer('player1')
      .withPower('player1', 12)
      .withPower('player2', 10)
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .withActionsTaken(7)
      .build();

    const result = processAction(state, {
      player: 'player2',
      action: { type: 'gain_mythium' },
    });

    expect(result.state.phase).toBe('gameOver');
    expect(result.state.winner).toBe('player1');
  });
});

describe('rally empty deck', () => {
  it('opponent gains 1 power when player cannot draw during rally', () => {
    // Player 1 has no deck, player 2 has a card to draw
    const state = buildState()
      .withActivePlayer('player2')
      .withFirstPlayer('player1')
      .addCard('militia_scout', 'player2', 'deck', { instanceId: 'p2d1' })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .withActionsTaken(7)
      .build();

    const result = processAction(state, {
      player: 'player2',
      action: { type: 'gain_mythium' },
    });

    // Player 1 can't draw → player 2 gains 1 power
    expectPlayerPower(result.state, 'player2', 1);
    // Player 1 does NOT gain power from their own empty deck
    expectPlayerPower(result.state, 'player1', 0);
  });
});

describe('getLegalActions', () => {
  it('returns basic actions for active player', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms2' })
      .addCard('watchtower', 'player1', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .build();

    const actions = getLegalActions(state);

    // Should include: gain_mythium, draw_card, buy_standing (4 guilds),
    // play militia_scout, attack with ms2, develop watchtower
    const types = actions.map(a => a.action.type);
    expect(types).toContain('gain_mythium');
    expect(types).toContain('draw_card');
    expect(types).toContain('buy_standing');
    expect(types).toContain('play_card');
    expect(types).toContain('attack');
    expect(types).toContain('develop');

    // All actions should be for player1
    expect(actions.every(a => a.player === 'player1')).toBe(true);
  });

  it('returns no actions when game is over', () => {
    const state = buildState().build();
    const overState = { ...state, phase: 'gameOver' as const, winner: 'player1' as const };

    expect(getLegalActions(overState)).toEqual([]);
  });

  it('returns blocker options during combat', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'blk1' })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    const actions = getLegalActions(r1.state);
    const types = actions.map(a => a.action.type);

    expect(types).toContain('pass_block');
    expect(types).toContain('declare_blocker');
    expect(actions.every(a => a.player === 'player2')).toBe(true);
  });
});

describe('worldbreaker abilities', () => {
  it('Stone Sentinel buffs attackers on your attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' }) // 1/1
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // Stone Sentinel should have triggered, buffing attacker by +1 str
    // Check for lasting effect
    expect(r1.state.lastingEffects.length).toBeGreaterThan(0);
    const buff = r1.state.lastingEffects.find(e => e.type === 'strength_buff');
    expect(buff).toBeDefined();
    expect(buff!.targetInstanceIds).toContain('atk1');

    // Pass block - breach should use buffed strength (1+1=2)
    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    expectPlayerPower(r2.state, 'player1', 1); // 1 power gained per breaching follower
    // Lasting effect should be expired after combat
    expect(r2.state.lastingEffects.length).toBe(0);
  });

  it('Void Oracle draws a card on your attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'draw1' })
      .addCard('void_oracle', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('stone_sentinel', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // Should have drawn a card from Void Oracle trigger
    const drawCard = r1.state.cards.find(c => c.instanceId === 'draw1');
    expect(drawCard!.zone).toBe('hand');
  });
});

describe('reproducibility', () => {
  it('same actions produce identical states', () => {
    const makeState = () => buildState()
      .withActivePlayer('player1')
      .withFirstPlayer('player1')
      .withRngState(42)
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'p1d1' })
      .addCard('shield_bearer', 'player1', 'deck', { instanceId: 'p1d2' })
      .addCard('militia_scout', 'player2', 'deck', { instanceId: 'p2d1' })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const actions = [
      { player: 'player1' as const, action: { type: 'gain_mythium' as const } },
      { player: 'player2' as const, action: { type: 'gain_mythium' as const } },
      { player: 'player1' as const, action: { type: 'draw_card' as const } },
      { player: 'player2' as const, action: { type: 'draw_card' as const } },
    ];

    let s1 = makeState();
    let s2 = makeState();

    for (const action of actions) {
      s1 = processAction(s1, action).state;
      s2 = processAction(s2, action).state;
    }

    expect(s1.players).toEqual(s2.players);
    expect(s1.cards.map(c => ({ id: c.instanceId, zone: c.zone }))).toEqual(
      s2.cards.map(c => ({ id: c.instanceId, zone: c.zone }))
    );
  });
});
