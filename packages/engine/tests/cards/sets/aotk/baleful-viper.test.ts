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

describe('Baleful Viper', () => {
  hasPlayCost('baleful_viper', 4, { void: 1 });

  describe('Lethal: defeats any follower it wounds', () => {
    it('defeats a blocker it wounds, even if the blocker has more health', () => {
      // Baleful Viper is 1/3. A shield_bearer is 2/4. Normally viper dies, bearer survives.
      // With lethal, any wound Baleful Viper deals to the bearer defeats it.
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('baleful_viper', 'player1', 'board', { instanceId: 'bv1' })
        .addCard('shield_bearer', 'player2', 'board', { instanceId: 'sb1' })
        .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
        .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
        .build();

      const attackResult = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['bv1'] },
      });

      const blockResult = processAction(attackResult.state, {
        player: 'player2',
        action: { type: 'declare_blocker', blockerId: 'sb1', attackerId: 'bv1' },
      });

      // shield_bearer (2/4) is defeated by lethal - it should be in discard
      expectCardInZone(blockResult.state, 'sb1', 'discard');
    });

    it('a blocker with strength 0 does not trigger lethal on the blocker', () => {
      // Baleful Viper has strength 1, so it deals wounds. Blocker must also have
      // strength > 0 for blocker's lethal to matter (blocker here has no lethal).
      // This test verifies the blocker without lethal does NOT get lethal bonus.
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('baleful_viper', 'player1', 'board', { instanceId: 'bv1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
        .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
        .build();

      const attackResult = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['bv1'] },
      });

      const blockResult = processAction(attackResult.state, {
        player: 'player2',
        action: { type: 'declare_blocker', blockerId: 'ms1', attackerId: 'bv1' },
      });

      // militia_scout (1/1) is defeated by viper's 1 damage - normal, not lethal-specific
      expectCardInZone(blockResult.state, 'ms1', 'discard');
      // Viper (1/3) takes 1 wound from militia_scout, but survives
      expectCardInZone(blockResult.state, 'bv1', 'board');
    });

    it('viper is defeated by a blocker with enough strength', () => {
      // earthshaker_giant (5/5) blocks viper (1/3). Giant deals 5 wounds to viper → viper dies.
      // Viper deals 1 wound to giant with lethal → giant dies too.
      const state = buildState()
        .withActivePlayer('player1')
        .addCard('baleful_viper', 'player1', 'board', { instanceId: 'bv1' })
        .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'eg1' })
        .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
        .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
        .build();

      const attackResult = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['bv1'] },
      });

      const blockResult = processAction(attackResult.state, {
        player: 'player2',
        action: { type: 'declare_blocker', blockerId: 'eg1', attackerId: 'bv1' },
      });

      // Both die: viper takes 5 wounds (defeats 3-health viper), giant takes lethal from 1 wound
      expectCardInZone(blockResult.state, 'bv1', 'discard');
      expectCardInZone(blockResult.state, 'eg1', 'discard');
    });
  });

  describe('Breach: Gain 1 Moon standing', () => {
    it('gains 1 void standing when it breaches', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withStanding('player1', 'void', 1)
        .addCard('baleful_viper', 'player1', 'board', { instanceId: 'bv1' })
        .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
        .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
        .build();

      const attackResult = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['bv1'] },
      });

      // Pass block (no defenders)
      const passResult = processAction(attackResult.state, {
        player: 'player2',
        action: { type: 'pass_block' },
      });

      expect(passResult.state.players.player1.standing.void).toBe(2);
    });

    it('does not gain void standing when blocked and does not breach', () => {
      const state = buildState()
        .withActivePlayer('player1')
        .withStanding('player1', 'void', 1)
        .addCard('baleful_viper', 'player1', 'board', { instanceId: 'bv1' })
        .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
        .addCard('stone_sentinel', 'player1', 'worldbreaker', { instanceId: 'wb1' })
        .addCard('void_oracle', 'player2', 'worldbreaker', { instanceId: 'wb2' })
        .build();

      const attackResult = processAction(state, {
        player: 'player1',
        action: { type: 'attack', attackerIds: ['bv1'] },
      });

      const blockResult = processAction(attackResult.state, {
        player: 'player2',
        action: { type: 'declare_blocker', blockerId: 'ms1', attackerId: 'bv1' },
      });

      expect(blockResult.state.players.player1.standing.void).toBe(1);
    });
  });
});
