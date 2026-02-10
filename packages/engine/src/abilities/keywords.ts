import { GameState, CardInstance } from '../types/state';
import { GameEvent } from '../types/events';
import { PlayerId, opponentOf } from '../types/core';
import { hasKeyword, getEffectiveStrength, isHidden, getCardDef } from '../state/query';
import { gainPower, addCounterToCard } from '../state/mutate';

/**
 * Stationary: Card cannot attack. Checked in canAttack query.
 * No runtime handler needed - it's a constraint check.
 */

/**
 * Bloodshed: When this follower deals combat damage to an opponent's follower,
 * deal additional wounds.
 */
export function applyBloodshed(
  state: GameState,
  attackerCard: CardInstance,
  _defenderCard: CardInstance,
): { state: GameState; events: GameEvent[] } {
  if (!hasKeyword(attackerCard, 'bloodshed')) return { state, events: [] };

  const def = getCardDef(attackerCard);
  const amount = def.bloodshedAmount ?? 0;
  if (amount <= 0) return { state, events: [] };

  // Bloodshed deals extra wounds to the blocking follower
  return addCounterToCard(state, _defenderCard.instanceId, 'wound', amount);
}

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
  if (!hasKeyword(attackerCard, 'overwhelm')) return { state, events: [] };
  return gainPower(state, player, 1);
}
