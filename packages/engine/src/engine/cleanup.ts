import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { removeLastingEffect } from '../state/mutate';

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
