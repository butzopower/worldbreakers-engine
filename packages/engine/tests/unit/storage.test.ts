import { describe, it, expect, beforeEach } from 'vitest';
import { processAction, getLegalActions } from '../../src';
import { buildState } from '../helpers/state-builder';
import { clearRegistry } from '../../src/cards/registry';
import { registerTestCards } from '../../src/cards/test-cards';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
});

describe('storage mechanic', () => {
  describe('storing a card', () => {
    it('enters ability allows storing a follower from hand', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        .withStanding('player1', 'moon', 2)
        .addCard('storage_keeper', 'player1', 'hand', { instanceId: 'keeper' })
        .addCard('militia_scout', 'player1', 'hand', { instanceId: 'scout' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
        .build();

      // Play the storage keeper
      let result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'keeper' },
      });

      // Should have a trigger order choice (enters ability is optional)
      expect(result.state.pendingChoice?.type).toBe('choose_trigger_order');

      // Choose to activate the enters trigger
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      // Should have a choose_store_target pending choice
      expect(result.state.pendingChoice?.type).toBe('choose_store_target');

      // Store the scout
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_store_target', cardInstanceId: 'scout' },
      });

      // Scout should be in 'stored' zone with storedOn pointing to keeper
      const scout = result.state.cards.find(c => c.instanceId === 'scout')!;
      expect(scout.zone).toBe('stored');
      expect(scout.storedOn).toBe('keeper');

      // Keeper should have scout in storedCards
      const keeper = result.state.cards.find(c => c.instanceId === 'keeper')!;
      expect(keeper.storedCards).toContain('scout');

      // Player should have drawn a card (follow-up effect)
      expect(result.state.players.player1.handSize).toBe(1);
    });

    it('can pass on storing a card', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        .withStanding('player1', 'moon', 2)
        .addCard('storage_keeper', 'player1', 'hand', { instanceId: 'keeper' })
        .addCard('militia_scout', 'player1', 'hand', { instanceId: 'scout' })
        .build();

      // Play the storage keeper
      let result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'keeper' },
      });

      // Choose to activate the enters trigger
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      // Pass on storing
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'pass_store' },
      });

      // Scout should still be in hand
      const scout = result.state.cards.find(c => c.instanceId === 'scout')!;
      expect(scout.zone).toBe('hand');

      // Keeper should have no stored cards
      const keeper = result.state.cards.find(c => c.instanceId === 'keeper')!;
      expect(keeper.storedCards).toHaveLength(0);
    });

    it('can skip the enters trigger entirely', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        .withStanding('player1', 'moon', 2)
        .addCard('storage_keeper', 'player1', 'hand', { instanceId: 'keeper' })
        .addCard('militia_scout', 'player1', 'hand', { instanceId: 'scout' })
        .build();

      let result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'keeper' },
      });

      // Skip the trigger
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'skip_trigger', triggerIndex: 0 },
      });

      // Scout still in hand
      const scout = result.state.cards.find(c => c.instanceId === 'scout')!;
      expect(scout.zone).toBe('hand');
    });

    it('does not draw a card when passing on store', () => {
      const initialHandSize = 2; // keeper + scout both in hand, keeper played, scout remains = 1, then no draw
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        .withStanding('player1', 'moon', 2)
        .addCard('storage_keeper', 'player1', 'hand', { instanceId: 'keeper' })
        .addCard('militia_scout', 'player1', 'hand', { instanceId: 'scout' })
        .build();

      let result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'keeper' },
      });

      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'pass_store' },
      });

      // After playing keeper (hand -1), scout still in hand = 1
      expect(result.state.players.player1.handSize).toBe(1);
    });
  });

  describe('stored cards leaving when host leaves board', () => {
    it('stored cards go to discard when host is defeated', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('storage_keeper', 'player1', 'board', { instanceId: 'keeper' })
        .addCard('militia_scout', 'player1', 'board', { instanceId: 'scout' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'event1' })
        .withStoredCard('scout', 'keeper')
        .build();

      // Use execution order to destroy the keeper
      let result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'event1' },
      });

      // Choose keeper as target
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'keeper' },
      });

      // Both keeper and scout should be in discard
      const keeper = result.state.cards.find(c => c.instanceId === 'keeper')!;
      const scout = result.state.cards.find(c => c.instanceId === 'scout')!;
      expect(keeper.zone).toBe('discard');
      expect(scout.zone).toBe('discard');
      expect(scout.storedOn).toBeNull();
      expect(keeper.storedCards).toHaveLength(0);
    });
  });

  describe('playing stored cards', () => {
    it('can play a stored card during blocks trigger', () => {
      // Set up a state where storage_keeper is blocking and has a stored card
      const state = buildState()
        .withActivePlayer('player2')
        .withMythium('player1', 10)
        .addCard('storage_keeper', 'player1', 'board', { instanceId: 'keeper' })
        .addCard('militia_scout', 'player1', 'board', { instanceId: 'stored_scout' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'attacker' })
        .withStoredCard('stored_scout', 'keeper')
        .build();

      // Player 2 attacks
      let result = processAction(state, {
        player: 'player2',
        action: { type: 'attack', attackerIds: ['attacker'] },
      });

      // Player 1 blocks with keeper
      expect(result.state.pendingChoice?.type).toBe('choose_blockers');
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'declare_blocker', blockerId: 'keeper', attackerId: 'attacker' },
      });

      // Blocks trigger fires — should get choose_trigger_order for forced blocks ability
      // The blocks trigger should prompt to play stored card
      // Since it's a forced trigger, it auto-resolves
      expect(result.state.pendingChoice?.type).toBe('choose_stored_card_to_play');

      // Choose to play the stored scout
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_stored_card_to_play', cardInstanceId: 'stored_scout' },
      });

      // The scout should now be on the board (played from storage)
      const scout = result.state.cards.find(c => c.instanceId === 'stored_scout')!;
      expect(scout.zone).toBe('board');
      expect(scout.storedOn).toBeNull();

      // Keeper should have no stored cards
      const keeper = result.state.cards.find(c => c.instanceId === 'keeper')!;
      expect(keeper.storedCards).toHaveLength(0);
    });

    it('can pass on playing a stored card', () => {
      const state = buildState()
        .withActivePlayer('player2')
        .withMythium('player1', 10)
        .addCard('storage_keeper', 'player1', 'board', { instanceId: 'keeper' })
        .addCard('militia_scout', 'player1', 'board', { instanceId: 'stored_scout' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'attacker' })
        .withStoredCard('stored_scout', 'keeper')
        .build();

      let result = processAction(state, {
        player: 'player2',
        action: { type: 'attack', attackerIds: ['attacker'] },
      });

      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'declare_blocker', blockerId: 'keeper', attackerId: 'attacker' },
      });

      expect(result.state.pendingChoice?.type).toBe('choose_stored_card_to_play');

      // Pass on playing
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'pass_play_stored' },
      });

      // Scout should still be stored
      const scout = result.state.cards.find(c => c.instanceId === 'stored_scout')!;
      expect(scout.zone).toBe('stored');
    });
  });

  describe('stored cards are not in play', () => {
    it('stored cards do not appear in board queries', () => {
      const state = buildState()
        .addCard('storage_keeper', 'player1', 'board', { instanceId: 'keeper' })
        .addCard('militia_scout', 'player1', 'board', { instanceId: 'scout' })
        .withStoredCard('scout', 'keeper')
        .build();

      const boardCards = state.cards.filter(c => c.zone === 'board');
      expect(boardCards).toHaveLength(1);
      expect(boardCards[0].instanceId).toBe('keeper');
    });
  });
});
