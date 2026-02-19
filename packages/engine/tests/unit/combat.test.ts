import { describe, it, expect, beforeEach } from 'vitest';
import { registerTestCards } from '../../src/cards/test-cards/index.js';
import { clearRegistry } from '../../src/cards/registry.js';
import { processAction } from '../../src/engine/engine.js';
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
