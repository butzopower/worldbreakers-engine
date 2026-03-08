import { describe, it, expect, beforeEach } from 'vitest';
import { registerTestCards } from '../../src/cards/test-cards';
import { clearRegistry } from '../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../src/engine/engine.js';
import { buildState } from '../helpers/state-builder.js';
import { expectPlayerMythium, expectHandSize } from '../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
});

describe('trigger ordering', () => {
  describe('single trigger auto-resolves', () => {
    it('does not prompt choice when only one trigger exists', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const mythiumBefore = playResult.state.players['player1'].mythium;

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      // Single trigger auto-resolves — no choose_trigger_order prompt
      expect(targetResult.waitingFor?.type).not.toBe('choose_trigger_order');
      expect(targetResult.state.players['player1'].mythium).toBe(mythiumBefore + 1);
    });
  });

  describe('multiple triggers prompt player choice', () => {
    it('presents choose_trigger_order when player has two follower_defeated triggers', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
        .addCard('soul_reaper', 'player1', 'board', { instanceId: 'sr1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      // Should prompt for trigger ordering
      expect(targetResult.waitingFor?.type).toBe('choose_trigger_order');
      expect(targetResult.waitingFor?.type === 'choose_trigger_order'
        && targetResult.waitingFor.triggers.length).toBe(2);
    });

    it('resolves chosen trigger first, then auto-resolves the remaining one', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
        .addCard('soul_reaper', 'player1', 'board', { instanceId: 'sr1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const mythiumBefore = playResult.state.players['player1'].mythium;
      const handSizeBefore = playResult.state.players['player1'].handSize;

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      // Choose death_watcher trigger (index 0 = dw1)
      const result = processAction(targetResult.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      // Both triggers should have resolved
      expect(result.state.players['player1'].mythium).toBe(mythiumBefore + 1);
      expect(result.state.players['player1'].handSize).toBe(handSizeBefore + 1);
    });

    it('provides legal actions for each trigger option', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
        .addCard('soul_reaper', 'player1', 'board', { instanceId: 'sr1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      const legal = getLegalActions(targetResult.state);
      const triggerActions = legal.filter(a => a.action.type === 'choose_trigger');
      expect(triggerActions.length).toBe(2);
    });
  });

  describe('active player triggers resolve first', () => {
    it('active player chooses trigger order before opponent when both have defeat triggers', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
        .addCard('death_watcher', 'player2', 'board', { instanceId: 'dw2' })
        .addCard('soul_reaper', 'player1', 'board', { instanceId: 'sr1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      // Active player (player1) should be prompted first — they have 2 triggers
      expect(targetResult.waitingFor?.type).toBe('choose_trigger_order');
      if (targetResult.waitingFor?.type === 'choose_trigger_order') {
        expect(targetResult.waitingFor.playerId).toBe('player1');
      }

      // Resolve player1's triggers
      const afterFirst = processAction(targetResult.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      // Player2's single trigger should auto-resolve (no prompt)
      expect(afterFirst.waitingFor?.type).not.toBe('choose_trigger_order');

      // Both players' triggers should have resolved
      expect(afterFirst.state.players['player1'].mythium).toBe(playResult.state.players['player1'].mythium + 1);
      expect(afterFirst.state.players['player1'].handSize).toBe(playResult.state.players['player1'].handSize + 1);
      expect(afterFirst.state.players['player2'].mythium).toBe(playResult.state.players['player2'].mythium + 1);
    });
  });

  describe('rally triggers with multiple abilities', () => {
    it('prompts choice when player has multiple rally triggers', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withFirstPlayer('player1')
        .withActionsTaken(7)
        .addCard('rally_herald', 'player1', 'board', { instanceId: 'rh1' })
        .addCard('rally_herald', 'player1', 'board', { instanceId: 'rh2' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
        .addCard('militia_scout', 'player2', 'deck', { instanceId: 'deck2' })
        .build();

      // Taking the 8th action triggers rally phase
      const result = processAction(state, {
        player: 'player1',
        action: { type: 'gain_mythium' },
      });

      // Should prompt for rally trigger ordering (2 rally heralds)
      expect(result.waitingFor?.type).toBe('choose_trigger_order');
      if (result.waitingFor?.type === 'choose_trigger_order') {
        expect(result.waitingFor.playerId).toBe('player1');
        expect(result.waitingFor.triggers.length).toBe(2);
      }
    });

    it('single rally trigger auto-resolves without choice', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withFirstPlayer('player1')
        .withActionsTaken(7)
        .addCard('rally_herald', 'player1', 'board', { instanceId: 'rh1' })
        .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
        .addCard('militia_scout', 'player2', 'deck', { instanceId: 'deck2' })
        .build();

      const mythiumBefore = state.players['player1'].mythium;

      const result = processAction(state, {
        player: 'player1',
        action: { type: 'gain_mythium' },
      });

      // Single rally trigger auto-resolves — no choice prompt
      expect(result.waitingFor?.type).not.toBe('choose_trigger_order');
      // Rally herald gives +1 mythium, plus rally phase gives +2, plus gain_mythium action gives +1
      expect(result.state.players['player1'].mythium).toBe(mythiumBefore + 1 + 1 + 2);
    });
  });

  describe('non-forced (optional) triggers', () => {
    it('single non-forced trigger prompts choose_trigger_order', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('optional_watcher', 'player1', 'board', { instanceId: 'ow1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      // Non-forced trigger should prompt — not auto-resolve
      expect(targetResult.waitingFor?.type).toBe('choose_trigger_order');
    });

    it('player can resolve a non-forced trigger via choose_trigger', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('optional_watcher', 'player1', 'board', { instanceId: 'ow1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const mythiumBefore = playResult.state.players['player1'].mythium;

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      const result = processAction(targetResult.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 0 },
      });

      expect(result.state.players['player1'].mythium).toBe(mythiumBefore + 1);
    });

    it('player can skip a non-forced trigger via skip_trigger', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('optional_watcher', 'player1', 'board', { instanceId: 'ow1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const mythiumBefore = playResult.state.players['player1'].mythium;

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      const result = processAction(targetResult.state, {
        player: 'player1',
        action: { type: 'skip_trigger', triggerIndex: 0 },
      });

      // Mythium should NOT have changed — trigger was skipped
      expect(result.state.players['player1'].mythium).toBe(mythiumBefore);
    });

    it('player cannot skip a forced trigger', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
        .addCard('soul_reaper', 'player1', 'board', { instanceId: 'sr1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      // Both triggers are forced — skip_trigger should be rejected
      expect(() => processAction(targetResult.state, {
        player: 'player1',
        action: { type: 'skip_trigger', triggerIndex: 0 },
      })).toThrow();
    });

    it('mixed forced + non-forced: can skip non-forced, forced must resolve', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
        .addCard('optional_watcher', 'player1', 'board', { instanceId: 'ow1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const mythiumBefore = playResult.state.players['player1'].mythium;

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      // Should have 2 triggers: death_watcher (forced) and optional_watcher (non-forced)
      expect(targetResult.waitingFor?.type).toBe('choose_trigger_order');

      const legal = getLegalActions(targetResult.state);
      const skipActions = legal.filter(a => a.action.type === 'skip_trigger');
      const chooseActions = legal.filter(a => a.action.type === 'choose_trigger');

      // Can choose either trigger
      expect(chooseActions.length).toBe(2);
      // Can only skip the non-forced one
      expect(skipActions.length).toBe(1);

      // Find the optional_watcher trigger index
      const triggers = targetResult.waitingFor?.type === 'choose_trigger_order'
        ? targetResult.waitingFor.triggers : [];
      const optionalIndex = triggers.findIndex(t => t.sourceCardId === 'ow1');

      // Skip the optional trigger
      const afterSkip = processAction(targetResult.state, {
        player: 'player1',
        action: { type: 'skip_trigger', triggerIndex: optionalIndex },
      });

      // The forced trigger (death_watcher) should auto-resolve now
      expect(afterSkip.waitingFor?.type).not.toBe('choose_trigger_order');
      // death_watcher gives +1 mythium (forced, must resolve)
      expect(afterSkip.state.players['player1'].mythium).toBe(mythiumBefore + 1);
    });
  });

  describe('validation', () => {
    it('rejects invalid trigger index', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
        .addCard('soul_reaper', 'player1', 'board', { instanceId: 'sr1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      expect(() => processAction(targetResult.state, {
        player: 'player1',
        action: { type: 'choose_trigger', triggerIndex: 5 },
      })).toThrow();
    });

    it('rejects wrong action type during trigger choice', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
        .addCard('soul_reaper', 'player1', 'board', { instanceId: 'sr1' })
        .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .build();

      const playResult = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'eo1' },
      });

      const targetResult = processAction(playResult.state, {
        player: 'player1',
        action: { type: 'choose_target', targetInstanceId: 'ms1' },
      });

      expect(() => processAction(targetResult.state, {
        player: 'player1',
        action: { type: 'gain_mythium' },
      })).toThrow();
    });
  });
});
