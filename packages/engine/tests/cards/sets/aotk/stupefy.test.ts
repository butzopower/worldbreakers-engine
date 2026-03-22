import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction, getLegalActions } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Stupefy', () => {
  hasPlayCost('stupefy', 0, { void: 1 });

  it('playing initiates an attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'void', 1)
      .addCard('stupefy', 'player1', 'hand', { instanceId: 'stup1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stup1' },
    });

    expect(result.waitingFor?.type).toBe('choose_attackers');
  });

  it('on successful breach with defender having > 3 cards, defender reveals 3 then attacker picks 1 to discard', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'void', 1)
      .addCard('stupefy', 'player1', 'hand', { instanceId: 'stup1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player2', 'hand', { instanceId: 'dh1' })
      .addCard('shield_bearer', 'player2', 'hand', { instanceId: 'dh2' })
      .addCard('night_raider', 'player2', 'hand', { instanceId: 'dh3' })
      .addCard('void_channeler', 'player2', 'hand', { instanceId: 'dh4' })
      .build();

    // Play stupefy
    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stup1' },
    });

    // Choose attacker
    const attackResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });

    // No blockers — breach happens, no locations so breach target is skipped,
    // on_breach response fires → defender must reveal 3 cards
    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    expect(passResult.waitingFor?.type).toBe('choose_reveal_for_opponent_discard');
    expect(passResult.waitingFor?.playerId).toBe('player2');

    // Check legal actions — should have C(4,3) = 4 combinations
    const legalActions = getLegalActions(passResult.state);
    expect(legalActions.length).toBe(4);

    // Defender reveals 3 cards
    const revealResult = processAction(passResult.state, {
      player: 'player2',
      action: { type: 'choose_reveal_for_opponent_discard', cardInstanceIds: ['dh1', 'dh2', 'dh3'] },
    });

    // Attacker picks 1 to discard via choose_mode
    expect(revealResult.waitingFor?.type).toBe('choose_mode');
    expect(revealResult.waitingFor?.playerId).toBe('player1');

    // Should have 3 modes (one per revealed card) with card names
    const choice = revealResult.state.pendingChoice!;
    expect(choice.type).toBe('choose_mode');
    if (choice.type === 'choose_mode') {
      expect(choice.modes.length).toBe(3);
      expect(choice.modes[0].label).toBe('Discard Militia Scout');
      expect(choice.modes[1].label).toBe('Discard Shield Bearer');
      expect(choice.modes[2].label).toBe('Discard Night Raider');
    }

    // Pick Shield Bearer to discard
    const discardResult = processAction(revealResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    // dh2 should be discarded
    const dh2 = discardResult.state.cards.find(c => c.instanceId === 'dh2')!;
    expect(dh2.zone).toBe('discard');

    // Other revealed cards still in hand
    const dh1 = discardResult.state.cards.find(c => c.instanceId === 'dh1')!;
    expect(dh1.zone).toBe('hand');
    const dh3 = discardResult.state.cards.find(c => c.instanceId === 'dh3')!;
    expect(dh3.zone).toBe('hand');
  });

  it('on successful breach with defender having <= 3 cards, auto-reveals all and attacker picks 1', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'void', 1)
      .addCard('stupefy', 'player1', 'hand', { instanceId: 'stup1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player2', 'hand', { instanceId: 'dh1' })
      .addCard('shield_bearer', 'player2', 'hand', { instanceId: 'dh2' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stup1' },
    });
    const attackResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });

    // No blockers — breach, no locations, on_breach fires
    // With only 2 cards (≤ 3), auto-reveals → attacker picks via choose_mode
    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    expect(passResult.waitingFor?.type).toBe('choose_mode');
    expect(passResult.waitingFor?.playerId).toBe('player1');

    // Should have reveal event
    expect(passResult.events.some(e => e.type === 'reveal')).toBe(true);

    // Should have 2 modes with card names
    const choice = passResult.state.pendingChoice!;
    if (choice.type === 'choose_mode') {
      expect(choice.modes.length).toBe(2);
      expect(choice.modes[0].label).toBe('Discard Militia Scout');
      expect(choice.modes[1].label).toBe('Discard Shield Bearer');
    }

    // Pick Militia Scout to discard
    const discardResult = processAction(passResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    const dh1 = discardResult.state.cards.find(c => c.instanceId === 'dh1')!;
    expect(dh1.zone).toBe('discard');
    const dh2 = discardResult.state.cards.find(c => c.instanceId === 'dh2')!;
    expect(dh2.zone).toBe('hand');
  });

  it('on successful breach with defender having 0 cards, no effect', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'void', 1)
      .addCard('stupefy', 'player1', 'hand', { instanceId: 'stup1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stup1' },
    });
    const attackResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });

    // No blockers — breach, no locations, on_breach fires but defender has 0 cards
    const passResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // No cards to reveal — combat ends, turn advances
    expect(passResult.state.activePlayer).toBe('player2');
    expect(passResult.waitingFor).toBeUndefined();
  });

  it('on_breach response does not fire if attack is blocked (no breach)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'void', 1)
      .addCard('stupefy', 'player1', 'hand', { instanceId: 'stup1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'eg1' })
      .addCard('militia_scout', 'player2', 'hand', { instanceId: 'dh1' })
      .addCard('shield_bearer', 'player2', 'hand', { instanceId: 'dh2' })
      .addCard('night_raider', 'player2', 'hand', { instanceId: 'dh3' })
      .addCard('void_channeler', 'player2', 'hand', { instanceId: 'dh4' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stup1' },
    });
    const attackResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });

    // Block with earthshaker giant — kills militia scout, no breach
    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'eg1', attackerId: 'ms1' },
    });

    // All defender's hand cards should still be in hand
    for (const id of ['dh1', 'dh2', 'dh3', 'dh4']) {
      const card = blockResult.state.cards.find(c => c.instanceId === id)!;
      expect(card.zone).toBe('hand');
    }
  });

  it('does nothing if no followers can attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'void', 1)
      .addCard('stupefy', 'player1', 'hand', { instanceId: 'stup1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'stup1' },
    });

    expect(result.state.activePlayer).toBe('player2');
  });
});
