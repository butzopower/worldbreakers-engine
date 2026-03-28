import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction, getLegalActions } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Muhandasat, Council of Engineers', () => {
  describe('Response: draws_location trigger', () => {
    it('stores a drawn location and draws a replacement card', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb' })
        .addCard('watchtower', 'player1', 'deck', { instanceId: 'loc1' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck2' })
        .build();

      // Draw card action (draws the location)
      let result = processAction(state, {
        player: 'player1',
        action: { type: 'draw_card' },
      });

      // Trigger fires — choose to activate (non-forced)
      expect(result.state.pendingChoice?.type).toBe('choose_trigger_order');
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      // Location should be stored on worldbreaker
      const loc1 = result.state.cards.find(c => c.instanceId === 'loc1')!;
      expect(loc1.zone).toBe('stored');
      expect(loc1.storedOn).toBe('wb');

      const wb = result.state.cards.find(c => c.instanceId === 'wb')!;
      expect(wb.storedCards).toContain('loc1');
      expect(wb.exhausted).toBe(true);

      // Replacement card should be drawn
      const deck2 = result.state.cards.find(c => c.instanceId === 'deck2')!;
      expect(deck2.zone).toBe('hand');
    });

    it('can skip the response trigger', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb' })
        .addCard('watchtower', 'player1', 'deck', { instanceId: 'loc1' })
        .build();

      let result = processAction(state, {
        player: 'player1',
        action: { type: 'draw_card' },
      });

      // Skip the trigger
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'skip_trigger', triggerIndex: 0 },
      });

      // Location should stay in hand
      const loc1 = result.state.cards.find(c => c.instanceId === 'loc1')!;
      expect(loc1.zone).toBe('hand');

      const wb = result.state.cards.find(c => c.instanceId === 'wb')!;
      expect(wb.storedCards).toHaveLength(0);
      expect(wb.exhausted).toBe(false);
    });

    it('does not trigger when drawing a non-location card', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'follower1' })
        .build();

      const result = processAction(state, {
        player: 'player1',
        action: { type: 'draw_card' },
      });

      // No trigger — follower drawn, not location
      expect(result.state.pendingChoice).toBeNull();
      const follower1 = result.state.cards.find(c => c.instanceId === 'follower1')!;
      expect(follower1.zone).toBe('hand');
    });

    it('does not trigger during rally phase draw', () => {
      // Set up a state near end of round so the next action triggers rally
      // During rally, both players draw — the Muhandasat should NOT trigger
      const state = buildState()
        .withActivePlayer('player1')
        .withActionsTaken(7) // Next action will be the 8th, triggering rally
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb' })
        .addCard('watchtower', 'player1', 'deck', { instanceId: 'loc1' })
        .addCard('militia_scout', 'player2', 'deck', { instanceId: 'p2deck' })
        .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
        .build();

      // Take the 8th action — triggers rally phase
      const result = processAction(state, {
        player: 'player1',
        action: { type: 'gain_mythium' },
      });

      // Rally draws happen, but no Muhandasat trigger should fire
      // Location should be drawn to hand normally during rally
      const loc1 = result.state.cards.find(c => c.instanceId === 'loc1')!;
      expect(loc1.zone).toBe('hand');

      const wb = result.state.cards.find(c => c.instanceId === 'wb')!;
      expect(wb.storedCards).toHaveLength(0);
      expect(wb.exhausted).toBe(false);
    });

    it('does not trigger when worldbreaker is already exhausted', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb', exhausted: true })
        .addCard('watchtower', 'player1', 'deck', { instanceId: 'loc1' })
        .build();

      const result = processAction(state, {
        player: 'player1',
        action: { type: 'draw_card' },
      });

      // No trigger because worldbreaker is exhausted (can't pay exhaust cost)
      expect(result.state.pendingChoice).toBeNull();
    });

    it('does not store when storage is full', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb' })
        .addCard('watchtower', 'player1', 'board', { instanceId: 'stored1' })
        .addCard('watchtower', 'player1', 'board', { instanceId: 'stored2' })
        .addCard('watchtower', 'player1', 'board', { instanceId: 'stored3' })
        .withStoredCard('stored1', 'wb')
        .withStoredCard('stored2', 'wb')
        .withStoredCard('stored3', 'wb')
        .addCard('watchtower', 'player1', 'deck', { instanceId: 'loc_new' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck2' })
        .build();

      let result = processAction(state, {
        player: 'player1',
        action: { type: 'draw_card' },
      });

      // Trigger fires (exhaust cost check passes)
      expect(result.state.pendingChoice?.type).toBe('choose_trigger_order');
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      // Storage was full — card stays in hand, but exhaust still happened and draw still happened
      const wb = result.state.cards.find(c => c.instanceId === 'wb')!;
      expect(wb.storedCards).toHaveLength(3);
      expect(wb.exhausted).toBe(true);

      const locNew = result.state.cards.find(c => c.instanceId === 'loc_new')!;
      expect(locNew.zone).toBe('hand');

      // Replacement draw still happens
      const deck2 = result.state.cards.find(c => c.instanceId === 'deck2')!;
      expect(deck2.zone).toBe('hand');
    });

    it('can store up to 3 locations', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb' })
        .addCard('watchtower', 'player1', 'board', { instanceId: 'stored1' })
        .addCard('watchtower', 'player1', 'board', { instanceId: 'stored2' })
        .withStoredCard('stored1', 'wb')
        .withStoredCard('stored2', 'wb')
        .addCard('watchtower', 'player1', 'deck', { instanceId: 'loc3' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck2' })
        .build();

      let result = processAction(state, {
        player: 'player1',
        action: { type: 'draw_card' },
      });

      // Should still trigger with 2 stored (capacity is 3)
      expect(result.state.pendingChoice?.type).toBe('choose_trigger_order');
      result = processAction(result.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      const wb = result.state.cards.find(c => c.instanceId === 'wb')!;
      expect(wb.storedCards).toHaveLength(3);
      expect(wb.storedCards).toContain('loc3');
    });
  });

  describe('Play stored locations as if in hand', () => {
    it('allows playing a stored location as a normal action', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        .withStanding('player1', 'earth', 1)
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb' })
        .addCard('watchtower', 'player1', 'board', { instanceId: 'stored_loc' })
        .withStoredCard('stored_loc', 'wb')
        .build();

      // Check legal actions include playing the stored location
      const legalActions = getLegalActions(state);
      const playStoredAction = legalActions.find(
        a => a.action.type === 'play_card' && a.action.cardInstanceId === 'stored_loc'
      );
      expect(playStoredAction).toBeDefined();

      // Play the stored location
      const result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'stored_loc' },
      });

      // Location should now be on the board
      const loc = result.state.cards.find(c => c.instanceId === 'stored_loc')!;
      expect(loc.zone).toBe('board');
      expect(loc.storedOn).toBeNull();

      // Worldbreaker should no longer have it stored
      const wb = result.state.cards.find(c => c.instanceId === 'wb')!;
      expect(wb.storedCards).not.toContain('stored_loc');
    });

    it('pays the cost when playing a stored location', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 5)
        .withStanding('player1', 'earth', 1)
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb' })
        // watchtower costs 2
        .addCard('watchtower', 'player1', 'board', { instanceId: 'stored_loc' })
        .withStoredCard('stored_loc', 'wb')
        .build();

      const result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'stored_loc' },
      });

      expect(result.state.players.player1.mythium).toBe(3);
    });

    it('cannot play stored location without enough mythium', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 0)
        .withStanding('player1', 'earth', 1)
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb' })
        .addCard('watchtower', 'player1', 'board', { instanceId: 'stored_loc' })
        .withStoredCard('stored_loc', 'wb')
        .build();

      const legalActions = getLegalActions(state);
      const playStoredAction = legalActions.find(
        a => a.action.type === 'play_card' && a.action.cardInstanceId === 'stored_loc'
      );
      expect(playStoredAction).toBeUndefined();
    });

    it('cannot play stored location without standing requirement', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        // No earth standing — watchtower requires earth: 1
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb' })
        .addCard('watchtower', 'player1', 'board', { instanceId: 'stored_loc' })
        .withStoredCard('stored_loc', 'wb')
        .build();

      const legalActions = getLegalActions(state);
      const playStoredAction = legalActions.find(
        a => a.action.type === 'play_card' && a.action.cardInstanceId === 'stored_loc'
      );
      expect(playStoredAction).toBeUndefined();
    });

    it('stored followers are NOT playable as hand (only locations)', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        .addCard('the_muhandasat_council_of_engineers', 'player1', 'worldbreaker', { instanceId: 'wb' })
        .addCard('militia_scout', 'player1', 'board', { instanceId: 'stored_follower' })
        .withStoredCard('stored_follower', 'wb')
        .build();

      const legalActions = getLegalActions(state);
      const playStoredAction = legalActions.find(
        a => a.action.type === 'play_card' && a.action.cardInstanceId === 'stored_follower'
      );
      expect(playStoredAction).toBeUndefined();
    });

    it('stored locations on other cards (without storedPlayableAsHand) are not playable', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', 10)
        .withStanding('player1', 'moon', 2)
        .withStanding('player1', 'earth', 1)
        .addCard('patient_mentor', 'player1', 'board', { instanceId: 'mentor' })
        .addCard('watchtower', 'player1', 'board', { instanceId: 'stored_loc' })
        .withStoredCard('stored_loc', 'mentor')
        .build();

      const legalActions = getLegalActions(state);
      const playStoredAction = legalActions.find(
        a => a.action.type === 'play_card' && a.action.cardInstanceId === 'stored_loc'
      );
      expect(playStoredAction).toBeUndefined();
    });
  });
});
