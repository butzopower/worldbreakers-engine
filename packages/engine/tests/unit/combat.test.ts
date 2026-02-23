import { describe, it, expect, beforeEach } from 'vitest';
import { registerTestCards } from '../../src/cards/test-cards/index.js';
import { clearRegistry } from '../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../src/engine/engine.js';
import { buildState } from '../helpers/state-builder.js';
import { expectCardInZone, expectPlayerPower, expectCardCounter, expectEvent } from '../helpers/assertions.js';
import { getCard } from '../../src/state/query.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
});

describe('combat - basic attack', () => {
  it('initiates combat and waits for blocker declaration', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    expect(result.state.combat).not.toBeNull();
    expect(result.state.combat!.attackingPlayer).toBe('player1');
    expect(result.waitingFor).toBeDefined();
    expect(result.waitingFor!.type).toBe('choose_blockers');
    expect(result.waitingFor!.playerId).toBe('player2');

    // Attacker should be exhausted
    const atk = getCard(result.state, 'atk1')!;
    expect(atk.exhausted).toBe(true);
  });

  it('unblocked attacker breaches for power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .build();

    // Attack
    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // Pass block
    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // Combat should be over, power gained
    expect(r2.state.combat).toBeNull();
    expectPlayerPower(r2.state, 'player1', 1); // militia scout str 1
    expectEvent(r2.events, 'breach');
  });

  it('advances turn after combat ends', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // Turn should have advanced after combat
    expect(r2.state.combat).toBeNull();
    expect(r2.state.activePlayer).toBe('player2');
  });
});

describe('combat - blocking', () => {
  it('blocker and attacker deal simultaneous damage', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('star_warden', 'player1', 'board', { instanceId: 'atk1' }) // 2/2
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk1' }) // 1/3
      .build();

    // Attack
    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // Block with single declare_blocker
    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'blk1', attackerId: 'atk1' },
    });

    // Star warden (2 str) deals 2 wounds to shield bearer (3 health) → survives
    // Shield bearer (1 str) deals 1 wound to star warden (2 health) → survives
    expect(r2.state.combat).toBeNull();
    expectCardInZone(r2.state, 'atk1', 'board');
    expectCardInZone(r2.state, 'blk1', 'board');
    expectCardCounter(r2.state, 'atk1', 'wound', 1);
    expectCardCounter(r2.state, 'blk1', 'wound', 2);

    // No breach since attacker was blocked
    expectPlayerPower(r2.state, 'player1', 0);
  });

  it('defeats blocker when wounds >= health', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('star_warden', 'player1', 'board', { instanceId: 'atk1' }) // 2/2
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'blk1' }) // 1/1
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'blk1', attackerId: 'atk1' },
    });

    // Militia scout defeated (2 wounds >= 1 health)
    expectCardInZone(r2.state, 'blk1', 'discard');
    // Star warden survives with 1 wound
    expectCardInZone(r2.state, 'atk1', 'board');
    expectCardCounter(r2.state, 'atk1', 'wound', 1);
  });

  it('accounts for +1/+1 counters', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('star_warden', 'player1', 'board', { instanceId: 'atk1' }) // 2/2
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'blk1', counters: { plus_one_plus_one: 2 } }) // 3/3
      .addCard('void_oracle', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'blk1', attackerId: 'atk1' },
    });

    // Militia scout survives with 2 wounds (2 wounds >= 1 health)
    expectCardInZone(r2.state, 'blk1', 'board');
    expectCardCounter(r2.state, 'blk1', 'wound', 2);
    // Star warden is defeated with 1 wound
    expectCardInZone(r2.state, 'atk1', 'discard');
  });

  it('blocker is exhausted after blocking', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('star_warden', 'player1', 'board', { instanceId: 'atk1' }) // 2/2
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk1' }) // 1/3
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'blk1', attackerId: 'atk1' },
    });

    const blk = getCard(r2.state, 'blk1')!;
    expect(blk.exhausted).toBe(true);
  });
});

describe('combat - keywords', () => {
  it('stationary units cannot attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('shield_bearer', 'player1', 'board', { instanceId: 'sb1' })
      .build();

    expect(() => processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['sb1'] },
    })).toThrow('Invalid action');
  });

  it('overwhelm grants power when blocker is defeated', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('star_warden', 'player1', 'board', { instanceId: 'sw1' }) // 2/2 overwhelm
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' }) // 1/1
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['sw1'] },
    });

    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ms1', attackerId: 'sw1' },
    });

    // Militia scout defeated, overwhelm grants 1 power
    expectCardInZone(r2.state, 'ms1', 'discard');
    expectPlayerPower(r2.state, 'player1', 1);
  });

  it('bloodshed deals extra wounds', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('night_raider', 'player1', 'board', { instanceId: 'nr1' }) // 2/1 bloodshed 1
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' }) // 1/3
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['nr1'] },
    });

    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'sb1', attackerId: 'nr1' },
    });

    // Night raider deals 2 + 1 bloodshed = 3 wounds to shield bearer (3 health) → defeated
    expectCardInZone(r2.state, 'sb1', 'discard');
    // Shield bearer deals 1 wound to night raider (1 health) → defeated
    expectCardInZone(r2.state, 'nr1', 'discard');
  });
});

describe('combat - multiple attackers', () => {
  it('handles multiple attackers with partial blocking (sequential)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' }) // 1/1
      .addCard('star_warden', 'player1', 'board', { instanceId: 'atk2' }) // 2/2
      .addCard('star_warden', 'player1', 'board', { instanceId: 'atk3' }) // 2/2
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'blk1' }) // 1/1
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1', 'atk2', 'atk3'] },
    });

    // Block atk1 with blk1 — fight resolves immediately
    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'blk1', attackerId: 'atk1' },
    });

    // atk1 and blk1 trade (both 1/1) — both defeated
    expectCardInZone(r2.state, 'atk1', 'discard');
    expectCardInZone(r2.state, 'blk1', 'discard');

    // Defender has no more ready followers, so combat proceeds to breach
    // atk2 and atk3 breaches for 2 power
    expect(r2.state.combat).toBeNull();
    expectPlayerPower(r2.state, 'player1', 2);
  });

  it('allows sequential blocking of multiple attackers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' }) // 1/1
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk2' }) // 1/1
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk1' }) // 1/3
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk2' }) // 1/3
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1', 'atk2'] },
    });

    // Block first attacker
    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'blk1', attackerId: 'atk1' },
    });

    // Fight resolved for atk1 vs blk1. atk1 defeated (1 wound >= 1 health).
    expectCardInZone(r2.state, 'atk1', 'discard');
    // blk1 survives with 1 wound (1/3)
    expectCardInZone(r2.state, 'blk1', 'board');

    // Defender should be asked to block again (blk2 is still ready, atk2 remains)
    expect(r2.state.pendingChoice).not.toBeNull();
    expect(r2.state.pendingChoice!.type).toBe('choose_blockers');

    // Block second attacker
    const r3 = processAction(r2.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'blk2', attackerId: 'atk2' },
    });

    // atk2 defeated, blk2 survives
    expectCardInZone(r3.state, 'atk2', 'discard');
    expectCardInZone(r3.state, 'blk2', 'board');

    // No attackers remain — no breach, combat ends
    expect(r3.state.combat).toBeNull();
    expectPlayerPower(r3.state, 'player1', 0);
  });

  it('pass_block skips straight to breach with all remaining attackers', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' }) // 1/1
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk2' }) // 1/1
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk1' }) // 1/3
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1', 'atk2'] },
    });

    // Pass — no blocking at all
    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // Both attackers breach for 1+1=2 power
    expect(r2.state.combat).toBeNull();
    expectPlayerPower(r2.state, 'player1', 2);
    expectEvent(r2.events, 'breach');
  });
});

describe('combat - breach location damage', () => {
  it('allows attacker to damage a location on breach', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // Should be waiting for breach target choice
    expect(r2.waitingFor).toBeDefined();
    expect(r2.waitingFor!.type).toBe('choose_breach_target');

    // Damage the location
    const r3 = processAction(r2.state, {
      player: 'player1',
      action: { type: 'damage_location', locationInstanceId: 'wt1' },
    });

    expectCardCounter(r3.state, 'wt1', 'stage', 2);
    expect(r3.state.combat).toBeNull();
  });

  it('allows skipping breach damage', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    const r3 = processAction(r2.state, {
      player: 'player1',
      action: { type: 'skip_breach_damage' },
    });

    // Location untouched
    expectCardCounter(r3.state, 'wt1', 'stage', 3);
    expect(r3.state.combat).toBeNull();
  });

  it('advances turn after breach location damage', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    const r3 = processAction(r2.state, {
      player: 'player1',
      action: { type: 'damage_location', locationInstanceId: 'wt1' },
    });

    // Turn should advance to player2 after breach damage
    expect(r3.state.combat).toBeNull();
    expect(r3.state.activePlayer).toBe('player2');
  });

  it('advances turn after skipping breach damage', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    const r3 = processAction(r2.state, {
      player: 'player1',
      action: { type: 'skip_breach_damage' },
    });

    // Turn should advance to player2 after skipping breach damage
    expect(r3.state.combat).toBeNull();
    expect(r3.state.activePlayer).toBe('player2');
  });
});

describe('combat - block restrictions', () => {
  describe('wounded_blocker restriction', () => {
    it('wounded followers cannot block a wound_dodge_attacker', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('wound_dodge_attacker', 'player1', 'board', { instanceId: 'atk1' }) // 2/2, can't be blocked by wounded
        .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk1', counters: { wound: 1 } }) // wounded
        .build();

      const r1 = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['atk1'] },
      });

      // choose_blockers prompt shown, but wounded blocker can't block this attacker
      expect(r1.state.pendingChoice).not.toBeNull();
      expect(r1.state.pendingChoice!.type).toBe('choose_blockers');

      const actions = getLegalActions(r1.state);
      const blockerActions = actions.filter(a => a.action.type === 'declare_blocker');
      expect(blockerActions.length).toBe(0);

      // Defender must pass — breach occurs
      const r2 = processAction(r1.state, {
        player: 'player2',
        action: { type: 'pass_block' },
      });
      expect(r2.state.combat).toBeNull();
      expectPlayerPower(r2.state, 'player1', 1);
    });

    it('unwounded followers can block a wound_dodge_attacker', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('wound_dodge_attacker', 'player1', 'board', { instanceId: 'atk1' }) // 2/2
        .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk1' }) // 1/3 unwounded
        .build();

      const r1 = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['atk1'] },
      });

      // Unwounded blocker should be able to block
      expect(r1.state.pendingChoice).not.toBeNull();
      expect(r1.state.pendingChoice!.type).toBe('choose_blockers');

      const r2 = processAction(r1.state, {
        player: 'player2',
        action: { type: 'declare_blocker', blockerId: 'blk1', attackerId: 'atk1' },
      });

      // Fight should resolve normally
      expectCardCounter(r2.state, 'blk1', 'wound', 2);
      expectCardCounter(r2.state, 'atk1', 'wound', 1);
    });
  });

  describe('min_blocker_strength restriction', () => {
    it('followers with strength >= value cannot block', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('strength_dodge_attacker', 'player1', 'board', { instanceId: 'atk1' }) // 2/2, can't be blocked by str >= 3
        .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'blk1' }) // 3/4
        .build();

      const r1 = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['atk1'] },
      });

      // choose_blockers prompt shown, but giant (str 3 >= 3) can't block
      expect(r1.state.pendingChoice).not.toBeNull();
      expect(r1.state.pendingChoice!.type).toBe('choose_blockers');

      const actions = getLegalActions(r1.state);
      const blockerActions = actions.filter(a => a.action.type === 'declare_blocker');
      expect(blockerActions.length).toBe(0);

      const r2 = processAction(r1.state, {
        player: 'player2',
        action: { type: 'pass_block' },
      });
      expect(r2.state.combat).toBeNull();
      expectPlayerPower(r2.state, 'player1', 1);
    });

    it('followers with strength < value can block', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('strength_dodge_attacker', 'player1', 'board', { instanceId: 'atk1' }) // 2/2
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'blk1' }) // 1/1 str < 3
        .build();

      const r1 = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['atk1'] },
      });

      // Scout has strength 1 (< 3) — can block
      expect(r1.state.pendingChoice).not.toBeNull();
      expect(r1.state.pendingChoice!.type).toBe('choose_blockers');
    });
  });

  describe('unblockable lasting effect', () => {
    it('prevents all blocking', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' })
        .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk1' }) // 1/3
        .build();

      // Manually add unblockable lasting effect
      const stateWithUnblockable = {
        ...state,
        lastingEffects: [{
          id: 'ub1',
          type: 'unblockable' as const,
          amount: 0,
          targetInstanceIds: ['atk1'],
          expiresAt: 'end_of_combat' as const,
        }],
      };

      const r1 = processAction(stateWithUnblockable, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['atk1'] },
      });

      // choose_blockers prompt shown, but no valid blocker actions
      expect(r1.state.pendingChoice).not.toBeNull();
      expect(r1.state.pendingChoice!.type).toBe('choose_blockers');

      const actions = getLegalActions(r1.state);
      const blockerActions = actions.filter(a => a.action.type === 'declare_blocker');
      expect(blockerActions.length).toBe(0);

      const r2 = processAction(r1.state, {
        player: 'player2',
        action: { type: 'pass_block' },
      });
      expect(r2.state.combat).toBeNull();
      expectPlayerPower(r2.state, 'player1', 1);
    });
  });

  describe('draw_aggro passive', () => {
    it('weaker co-attackers cannot be blocked while draw_aggro is in combat', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('intimidate_attacker', 'player1', 'board', { instanceId: 'aggro1' }) // 4/4 draw_aggro
        .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' }) // 1/1 (weaker)
        .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk1' }) // 1/3
        .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk2' }) // 1/3
        .build();

      const r1 = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['aggro1', 'atk1'] },
      });

      // Blocking phase — should only allow blocking the aggro drawer (str 4 >= 4)
      // militia_scout (str 1 < 4) can't be blocked
      const actions = getLegalActions(r1.state);
      const blockerActions = actions.filter(a => a.action.type === 'declare_blocker');

      // Should only have blocker actions for aggro1 (the aggro_drawer itself), not atk1
      const blockAtk1 = blockerActions.filter(a =>
        a.action.type === 'declare_blocker' && a.action.attackerId === 'atk1'
      );
      const blockIntim = blockerActions.filter(a =>
        a.action.type === 'declare_blocker' && a.action.attackerId === 'aggro1'
      );

      expect(blockAtk1.length).toBe(0);
      expect(blockIntim.length).toBeGreaterThan(0);
    });

    it('equal or greater strength co-attackers can be blocked', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('intimidate_attacker', 'player1', 'board', { instanceId: 'aggro1' }) // 4/4 draw_aggro
        .addCard('earthshaker_giant', 'player1', 'board', { instanceId: 'atk1' }) // 3/4 — but add +1/+1 to make str 4
        .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk1' }) // 1/3
        .build();

      // Give giant a +1/+1 counter so its effective strength is 4 (equal to aggro)
      const giantCard = state.cards.find(c => c.instanceId === 'atk1')!;
      giantCard.counters = { plus_one_plus_one: 1 };

      const r1 = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['aggro1', 'atk1'] },
      });

      const actions = getLegalActions(r1.state);
      const blockAtk1 = actions.filter(a =>
        a.action.type === 'declare_blocker' && a.action.attackerId === 'atk1'
      );

      // Giant has str 4 (>= aggro's 4) — CAN be blocked
      expect(blockAtk1.length).toBeGreaterThan(0);
    });

    it('blocking the aggro follower removes its aura, making weaker attackers blockable', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('intimidate_attacker', 'player1', 'board', { instanceId: 'aggro1' }) // 4/4 draw_aggro
        .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' }) // 1/1 (weaker)
        .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'blk1' }) // 3/4 (can block the aggro)
        .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk2' }) // 1/3
        .build();

      const r1 = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['aggro1', 'atk1'] },
      });

      // Block the aggro — removes it from combat
      const r2 = processAction(r1.state, {
        player: 'player2',
        action: { type: 'declare_blocker', blockerId: 'blk1', attackerId: 'aggro1' },
      });

      // aggro1 was blocked and removed from attackerIds
      // Now atk1 should be blockable since draw_aggro aura is gone
      expect(r2.state.pendingChoice).not.toBeNull();
      expect(r2.state.pendingChoice!.type).toBe('choose_blockers');

      const actions = getLegalActions(r2.state);
      const blockAtk1 = actions.filter(a =>
        a.action.type === 'declare_blocker' && a.action.attackerId === 'atk1'
      );
      expect(blockAtk1.length).toBeGreaterThan(0);
    });
  });

  it('pass_block is always available regardless of restrictions', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('wound_dodge_attacker', 'player1', 'board', { instanceId: 'atk1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk1', counters: { wound: 1 } }) // wounded — can't block
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'blk2', counters: { wound: 1 } }) // wounded — can't block
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1'] },
    });

    // choose_blockers prompt is still shown — pass_block is always available
    expect(r1.state.pendingChoice).not.toBeNull();
    expect(r1.state.pendingChoice!.type).toBe('choose_blockers');

    const actions = getLegalActions(r1.state);
    expect(actions.length).toBe(1);
    expect(actions[0].action.type).toBe('pass_block');

    // Pass block — breach occurs
    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    expect(r2.state.combat).toBeNull();
    expectPlayerPower(r2.state, 'player1', 1);
  });

  it('getLegalActions returns only pass_block when all pairs are restricted', () => {
    // Set up state mid-combat with choose_blockers pending but no valid pairs
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('wound_dodge_attacker', 'player1', 'board', { instanceId: 'atk1', exhausted: true })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'blk1', counters: { wound: 1 } }) // wounded
      .build();

    // Manually set up combat state as if we're in choose_blockers
    const combatState = {
      ...state,
      combat: {
        step: 'declare_blockers' as const,
        attackingPlayer: 'player1' as const,
        attackerIds: ['atk1'],
      },
      pendingChoice: {
        type: 'choose_blockers' as const,
        playerId: 'player2' as const,
        attackerIds: ['atk1'],
      },
    };

    const actions = getLegalActions(combatState);
    expect(actions.length).toBe(1);
    expect(actions[0].action.type).toBe('pass_block');
  });
});
