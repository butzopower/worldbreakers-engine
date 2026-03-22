import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Patient Mentor', () => {
  hasPlayCost('patient_mentor', 5, { moon: 2 });

  describe('enters: store a follower from hand to draw a card', () => {
    it('stores a follower from hand and draws a card', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        .withStanding('player1', 'moon', 2)
        .addCard('patient_mentor', 'player1', 'hand', { instanceId: 'mentor' })
        .addCard('militia_scout', 'player1', 'hand', { instanceId: 'scout' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
        .build();

      // Play Patient Mentor
      let result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'mentor' },
      });

      // Enters trigger — optional, choose to activate
      expect(result.state.pendingChoice?.type).toBe('choose_trigger_order');
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      // Choose store target
      expect(result.state.pendingChoice?.type).toBe('choose_store_target');
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_store_target', cardInstanceId: 'scout' },
      });

      // Scout should be stored on mentor
      const scout = result.state.cards.find(c => c.instanceId === 'scout')!;
      expect(scout.zone).toBe('stored');
      expect(scout.storedOn).toBe('mentor');

      const mentor = result.state.cards.find(c => c.instanceId === 'mentor')!;
      expect(mentor.storedCards).toContain('scout');

      // Should have drawn a card (deck1 moved to hand)
      const deck1 = result.state.cards.find(c => c.instanceId === 'deck1')!;
      expect(deck1.zone).toBe('hand');
    });

    it('can skip the enters trigger', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        .withStanding('player1', 'moon', 2)
        .addCard('patient_mentor', 'player1', 'hand', { instanceId: 'mentor' })
        .addCard('militia_scout', 'player1', 'hand', { instanceId: 'scout' })
        .build();

      let result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'mentor' },
      });

      // Skip the trigger
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'skip_trigger', triggerIndex: 0 },
      });

      // Scout should remain in hand, nothing stored
      const scout = result.state.cards.find(c => c.instanceId === 'scout')!;
      expect(scout.zone).toBe('hand');

      const mentor = result.state.cards.find(c => c.instanceId === 'mentor')!;
      expect(mentor.storedCards).toHaveLength(0);
    });

    it('can pass on store target selection', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        .withStanding('player1', 'moon', 2)
        .addCard('patient_mentor', 'player1', 'hand', { instanceId: 'mentor' })
        .addCard('militia_scout', 'player1', 'hand', { instanceId: 'scout' })
        .build();

      let result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'mentor' },
      });

      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      // Pass on storing
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'pass_store' },
      });

      const scout = result.state.cards.find(c => c.instanceId === 'scout')!;
      expect(scout.zone).toBe('hand');
    });

    it('does not draw when passing on store', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        .withStanding('player1', 'moon', 2)
        .addCard('patient_mentor', 'player1', 'hand', { instanceId: 'mentor' })
        .addCard('militia_scout', 'player1', 'hand', { instanceId: 'scout' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
        .build();

      let result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'mentor' },
      });

      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'pass_store' },
      });

      // deck1 should still be in deck (no draw happened)
      const deck1 = result.state.cards.find(c => c.instanceId === 'deck1')!;
      expect(deck1.zone).toBe('deck');
    });
  });

  describe('blocks: play a card stored here', () => {
    it('plays stored card when blocking', () => {
      const state = buildState()
        .withActivePlayer('player2')
        .withMythium('player1', 10)
        .addCard('patient_mentor', 'player1', 'board', { instanceId: 'mentor' })
        .addCard('militia_scout', 'player1', 'board', { instanceId: 'stored_scout' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'attacker' })
        .withStoredCard('stored_scout', 'mentor')
        .build();

      // Player 2 attacks
      let result = processAction(state, {
        player: 'player2',
        action: { type: 'attack', attackerIds: ['attacker'] },
      });

      // Player 1 blocks with mentor
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'declare_blocker', blockerId: 'mentor', attackerId: 'attacker' },
      });

      // Blocks trigger is optional — choose to activate
      expect(result.state.pendingChoice?.type).toBe('choose_trigger_order');
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      expect(result.state.pendingChoice?.type).toBe('choose_stored_card_to_play');

      // Choose to play the stored scout
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_stored_card_to_play', cardInstanceId: 'stored_scout' },
      });

      // Scout should now be on the board
      const scout = result.state.cards.find(c => c.instanceId === 'stored_scout')!;
      expect(scout.zone).toBe('board');
      expect(scout.storedOn).toBeNull();

      // Mentor should have no stored cards
      const mentor = result.state.cards.find(c => c.instanceId === 'mentor')!;
      expect(mentor.storedCards).toHaveLength(0);
    });

    it('can pass on playing stored card when blocking', () => {
      const state = buildState()
        .withActivePlayer('player2')
        .addCard('patient_mentor', 'player1', 'board', { instanceId: 'mentor' })
        .addCard('militia_scout', 'player1', 'board', { instanceId: 'stored_scout' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'attacker' })
        .withStoredCard('stored_scout', 'mentor')
        .build();

      let result = processAction(state, {
        player: 'player2',
        action: { type: 'attack', attackerIds: ['attacker'] },
      });

      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'declare_blocker', blockerId: 'mentor', attackerId: 'attacker' },
      });

      // Skip the optional blocks trigger entirely
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'skip_trigger', triggerIndex: 0 },
      });

      // Scout should still be stored
      const scout = result.state.cards.find(c => c.instanceId === 'stored_scout')!;
      expect(scout.zone).toBe('stored');
    });

    it('pays mythium cost when playing stored card', () => {
      const state = buildState()
        .withActivePlayer('player2')
        .withMythium('player1', 3)
        .addCard('patient_mentor', 'player1', 'board', { instanceId: 'mentor' })
        // shield_bearer costs 2 mythium
        .addCard('shield_bearer', 'player1', 'board', { instanceId: 'stored_sb' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'attacker' })
        .withStoredCard('stored_sb', 'mentor')
        .build();

      let result = processAction(state, {
        player: 'player2',
        action: { type: 'attack', attackerIds: ['attacker'] },
      });

      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'declare_blocker', blockerId: 'mentor', attackerId: 'attacker' },
      });

      // Choose to activate the blocks trigger
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_stored_card_to_play', cardInstanceId: 'stored_sb' },
      });

      // Should have spent 2 mythium (shield_bearer cost)
      expect(result.state.players.player1.mythium).toBe(1);
    });
  });

  describe('stored cards discard when host leaves', () => {
    it('stored card goes to discard when mentor is defeated', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('patient_mentor', 'player1', 'board', { instanceId: 'mentor' })
        .addCard('militia_scout', 'player1', 'board', { instanceId: 'stored_scout' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'event1' })
        .withStoredCard('stored_scout', 'mentor')
        .build();

      let result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'event1' },
      });

      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'mentor' },
      });

      const mentor = result.state.cards.find(c => c.instanceId === 'mentor')!;
      const scout = result.state.cards.find(c => c.instanceId === 'stored_scout')!;
      expect(mentor.zone).toBe('discard');
      expect(scout.zone).toBe('discard');
      expect(scout.storedOn).toBeNull();
    });
  });
});
