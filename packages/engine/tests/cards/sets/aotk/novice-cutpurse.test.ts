import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';
import { autoAccept } from "../../../helpers/game";

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Novice Cutpurse', () => {
  hasPlayCost('novice_cutpurse', 1, { void: 1 });

  it('triggers when blocked, gaining 2 mythium and presenting standing choice', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 1)
      .addCard('novice_cutpurse', 'player1', 'board', { instanceId: 'nc1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['nc1'] },
    });

    expect(attackResult.waitingFor?.type).toBe('choose_blockers');

    // Player 2 blocks — triggers is_blocked on the cutpurse
    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'sb1', attackerId: 'nc1' },
    });

    // Non-forced trigger — presents choose_trigger_order to attacker (player1)
    const triggerResult = autoAccept(blockResult);

    // Should have gained 2 mythium
    expectPlayerMythium(triggerResult.state, 'player1', 7);

    // Should be waiting for standing guild choice
    expect(triggerResult.waitingFor?.type).toBe('choose_mode');
  });

  it('gains standing with chosen guild after being blocked', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 1)
      .addCard('novice_cutpurse', 'player1', 'board', { instanceId: 'nc1' })
      .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['nc1'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'sb1', attackerId: 'nc1' },
    });

    const triggerResult = autoAccept(blockResult);

    // Choose earth standing
    const chooseResult = processAction(triggerResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expect(chooseResult.state.players.player1.standing.earth).toBe(1);
  });

  it('triggers before combat damage resolves (cutpurse dies but still gets rewards)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 1)
      .addCard('novice_cutpurse', 'player1', 'board', { instanceId: 'nc1' })
      .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'eg1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['nc1'] },
    });

    // Block with earthshaker giant (3/4) — will kill cutpurse (1/1)
    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'eg1', attackerId: 'nc1' },
    });

    const triggerResult = autoAccept(blockResult);

    // Should have gained 2 mythium before dying
    expectPlayerMythium(triggerResult.state, 'player1', 7);

    // Choose void standing
    const chooseResult = processAction(triggerResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 2 },
    });

    // Standing gained before combat resolves
    expect(chooseResult.state.players.player1.standing.void).toBe(2);

    // After combat resolves, cutpurse should be in discard
    const cutpurse = chooseResult.state.cards.find(c => c.instanceId === 'nc1')!;
    expect(cutpurse.zone).toBe('discard');
  });

  it('does not trigger when attacking and not blocked', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 1)
      .addCard('novice_cutpurse', 'player1', 'board', { instanceId: 'nc1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['nc1'] },
    });

    // No blockers available — should go to breach
    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // Should not have gained mythium from is_blocked trigger
    expectPlayerMythium(passResult.state, 'player1', 5);
  });
});
