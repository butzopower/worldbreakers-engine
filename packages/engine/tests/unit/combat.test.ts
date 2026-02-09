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

    // Combat should be over, power gained (Void Oracle draws, no str buff)
    expect(r2.state.combat).toBeNull();
    expectPlayerPower(r2.state, 'player1', 1); // militia scout str 1
    expectEvent(r2.events, 'breach');
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

    // Block
    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'declare_blockers', assignments: { 'blk1': 'atk1' } },
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
      action: { type: 'declare_blockers', assignments: { 'blk1': 'atk1' } },
    });

    // Militia scout defeated (2 wounds >= 1 health)
    expectCardInZone(r2.state, 'blk1', 'discard');
    // Star warden survives with 1 wound
    expectCardInZone(r2.state, 'atk1', 'board');
    expectCardCounter(r2.state, 'atk1', 'wound', 1);
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
      action: { type: 'declare_blockers', assignments: { 'ms1': 'sw1' } },
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
      action: { type: 'declare_blockers', assignments: { 'sb1': 'nr1' } },
    });

    // Night raider deals 2 + 1 bloodshed = 3 wounds to shield bearer (3 health) → defeated
    expectCardInZone(r2.state, 'sb1', 'discard');
    // Shield bearer deals 1 wound to night raider (1 health) → defeated
    expectCardInZone(r2.state, 'nr1', 'discard');
  });
});

describe('combat - multiple attackers', () => {
  it('handles multiple attackers with partial blocking', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'atk1' }) // 1/1
      .addCard('star_warden', 'player1', 'board', { instanceId: 'atk2' }) // 2/2
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'blk1' }) // 1/1
      .build();

    const r1 = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['atk1', 'atk2'] },
    });

    // Block only atk1
    const r2 = processAction(r1.state, {
      player: 'player2',
      action: { type: 'declare_blockers', assignments: { 'blk1': 'atk1' } },
    });

    // atk1 and blk1 trade (both 1/1), atk2 breaches
    expectCardInZone(r2.state, 'atk1', 'discard');
    expectCardInZone(r2.state, 'blk1', 'discard');
    // Star warden breaches for 2 power
    expectPlayerPower(r2.state, 'player1', 2);
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
});
