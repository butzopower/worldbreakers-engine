import { GameState, CardInstance } from '../types/state';
import { GameEvent } from '../types/events';
import { PlayerId, opponentOf } from '../types/core';
import { hasKeyword } from '../state/query';
import { gainPower } from '../state/mutate';

/**
 * Stationary: Card cannot attack. Checked in canAttack query.
 * No runtime handler needed - it's a constraint check.
 */

/**
 * Hidden: Card cannot be targeted by opponent's abilities.
 * Checked in target validation. Also protects from combat damage in breach.
 */

/**
 * Overwhelm: When this follower defeats a blocker in combat,
 * the attacking player gains 1 power.
 */
export function applyOverwhelm(
  state: GameState,
  attackerCard: CardInstance,
  player: PlayerId,
): { state: GameState; events: GameEvent[] } {
  if (!hasKeyword(state, attackerCard, 'overwhelm')) return { state, events: [] };
  return gainPower(state, player, 1);
}
