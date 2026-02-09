import { GameState } from '../types/state.js';
import { GameEvent } from '../types/events.js';
import { getCardDef, isDefeated, isLocationDepleted } from '../state/query.js';
import { moveCard, removeLastingEffect } from '../state/mutate.js';

/**
 * Recursive cleanup loop. After every state-changing operation:
 * 1. Check defeated followers (wounds >= health) → move to discard
 * 2. Check depleted locations (no stage counters) → move to discard
 * 3. Check expired lasting effects → remove
 * If any changes were made, run again.
 */
export function runCleanup(state: GameState, events: GameEvent[] = []): { state: GameState; events: GameEvent[] } {
  let changed = false;
  let s = state;
  const newEvents: GameEvent[] = [];

  // 1. Defeated followers
  const boardFollowers = s.cards.filter(c => c.zone === 'board' && getCardDef(c).type === 'follower');
  for (const card of boardFollowers) {
    if (isDefeated(card)) {
      const result = moveCard(s, card.instanceId, 'discard');
      s = result.state;
      newEvents.push(...result.events);
      newEvents.push({ type: 'card_defeated', cardInstanceId: card.instanceId });
      changed = true;
    }
  }

  // 2. Depleted locations
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

  // 3. No lasting effect expiry here - that's handled by phase transitions

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
