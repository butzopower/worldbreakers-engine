import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { getCard, isHidden } from '../state/query';
import { removeCounterFromCard } from '../state/mutate';
import { runCleanup } from '../engine/cleanup';
import { endCombat } from './combat';

/**
 * Handle breach location damage choice.
 */
export function handleBreachDamage(
  state: GameState,
  locationInstanceId: string,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  const location = getCard(s, locationInstanceId);
  if (!location || isHidden(s, location)) {
    return endCombat(s, events);
  }

  // Remove 1 stage counter from location
  const removeResult = removeCounterFromCard(s, locationInstanceId, 'stage', 1);
  s = removeResult.state;
  events.push(...removeResult.events);
  events.push({ type: 'location_damaged', locationInstanceId, amount: 1 });

  // Cleanup (may deplete location)
  const cleanupResult = runCleanup(s);
  s = cleanupResult.state;
  events.push(...cleanupResult.events);

  return endCombat(s, events);
}

/**
 * Skip breach damage.
 */
export function handleSkipBreachDamage(
  state: GameState,
): { state: GameState; events: GameEvent[] } {
  return endCombat(state, []);
}
