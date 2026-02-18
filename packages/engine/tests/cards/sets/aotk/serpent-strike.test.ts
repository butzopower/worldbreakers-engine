import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Serpent Strike', () => {
  hasPlayCost('serpent_strike', 1, { void: 1 });

  it('plays from hand, goes to discard, and presents choose_attackers when followers are available', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 1)
      .addCard('serpent_strike', 'player1', 'hand', { instanceId: 'ss1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ss1' },
    });

    expectCardInZone(result.state, 'ss1', 'discard');
    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_attackers');
  });

  it('with no attackable followers, the attack does nothing and turn advances', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 1)
      .addCard('serpent_strike', 'player1', 'hand', { instanceId: 'ss1' })
      // No followers on board
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ss1' },
    });

    expect(result.state.pendingChoice).toBeNull();
    expect(result.state.combat).toBeNull();
    expect(result.state.activePlayer).toBe('player2');
  });

  it('granted followers defeat any follower they wound via lethal', () => {
    // militia_scout is 1/1. void_channeler is 1/2.
    // Without lethal: scout deals 1 wound to channeler (2 health) → channeler survives.
    // With lethal (from serpent_strike): any wound → channeler is defeated.
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 1)
      .addCard('serpent_strike', 'player1', 'hand', { instanceId: 'ss1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('void_channeler', 'player2', 'board', { instanceId: 'vc1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ss1' },
    });

    expect(playResult.state.pendingChoice!.type).toBe('choose_attackers');

    const chooseAttackers = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });

    const blockResult = processAction(chooseAttackers.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'vc1', attackerId: 'ms1' },
    });

    // void_channeler (1/2) would normally survive 1 wound, but lethal defeats it
    expectCardInZone(blockResult.state, 'vc1', 'discard');
  });

  it('only player1 followers get lethal — player2 followers are unaffected', () => {
    // player2's blocker does NOT have lethal, so it only does normal damage
    // militia_scout (1/1) attacks, void_channeler (1/2) blocks
    // channeler (no lethal) deals 1 wound → scout dies (1 health)
    // scout (lethal) deals 1 wound → channeler dies (lethal)
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 1)
      .addCard('serpent_strike', 'player1', 'hand', { instanceId: 'ss1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('void_channeler', 'player2', 'board', { instanceId: 'vc1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ss1' },
    });

    const chooseAttackers = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });

    const blockResult = processAction(chooseAttackers.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'vc1', attackerId: 'ms1' },
    });

    // scout (1/1) takes 1 wound from channeler → dies normally
    expectCardInZone(blockResult.state, 'ms1', 'discard');
    // channeler dies from lethal on scout, not from channeler's own lethal
    expectCardInZone(blockResult.state, 'vc1', 'discard');
  });

  it('lethal expires after combat ends', () => {
    // Play serpent_strike, attack, pass block (no defenders). After combat ends,
    // the lethal lasting effect should be gone.
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 1)
      .addCard('serpent_strike', 'player1', 'hand', { instanceId: 'ss1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ss1' },
    });

    const chooseAttackers = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['ms1'] },
    });

    // Pass block — no defenders
    const passResult = processAction(chooseAttackers.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // After combat completes, no lethal lasting effects should remain
    const lethalEffects = passResult.state.lastingEffects.filter(e => e.type === 'lethal');
    expect(lethalEffects).toHaveLength(0);
  });
});
