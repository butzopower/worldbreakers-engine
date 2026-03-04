import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { getCardDef, isLocationDepleted } from '../state/query';
import { moveCard, removeLastingEffect } from '../state/mutate';

/**
 * Cleanup loop for non-follower cards. Handles:
 * 1. Depleted locations (no stage counters) → move to discard
 * 2. Expired lasting effects (handled by phase transitions, not here)
 *
 * Defeated followers are handled by handleCleanup in step-handlers.ts
 * which defers their move-to-discard until after triggers resolve.
 */
export function runCleanup(state: GameState, events: GameEvent[] = []): { state: GameState; events: GameEvent[] } {
  let changed = false;
  let s = state;
  const newEvents: GameEvent[] = [];

  // Depleted locations
  const boardLocations = s.cards.filter(c => c.zone === 'board' && getCardDef(c).type === 'location');
  for (const card of boardLocations) {
    if (isLocationDepleted(card)) {
      const result = moveCard(s, card.instanceId, 'discard');
      s = result.state;
      newEvents.push(...result.events);
      newEvents.push({ type: 'location_depleted', locationInstanceId: card.instanceId });
      changed = true;
    }
  }

  const allEvents = [...events, ...newEvents];

  if (changed) {
    return runCleanup(s, allEvents);
  }

  return { state: s, events: allEvents };
}

/**
 * Expire lasting effects of a given type.
 */
export function expireLastingEffects(
  state: GameState,
  expiresAt: 'end_of_combat' | 'end_of_turn' | 'end_of_round',
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  const toExpire = s.lastingEffects.filter(e => e.expiresAt === expiresAt);
  for (const effect of toExpire) {
    const result = removeLastingEffect(s, effect.id);
    s = result.state;
    events.push(...result.events);
  }

  return { state: s, events };
}
