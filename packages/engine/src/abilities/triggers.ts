import { PlayerId } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { AbilityTiming } from '../types/effects';
import { getCardDef, getBoard, getWorldbreaker } from '../state/query';
import { resolveAbility } from './resolver';

interface TriggerContext {
  triggeringCardId?: string;
  attackerIds?: string[];
  [key: string]: unknown;
}

/**
 * Scan all cards for abilities matching the given timing,
 * then resolve them in order.
 */
export function resolveTriggeredAbilities(
  state: GameState,
  timing: AbilityTiming,
  player: PlayerId,
  context: TriggerContext,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  // Check worldbreaker
  const wb = getWorldbreaker(s, player);
  if (wb) {
    const wbDef = getCardDef(wb);
    if (wbDef.abilities) {
      for (let i = 0; i < wbDef.abilities.length; i++) {
        const ability = wbDef.abilities[i];
        if (ability.timing === timing) {
          events.push({ type: 'ability_triggered', cardInstanceId: wb.instanceId, abilityIndex: i, timing });
          const result = resolveAbility(s, player, wb.instanceId, ability, i, context.triggeringCardId);
          s = result.state;
          events.push(...result.events);
        }
      }
    }
  }

  // Check board cards
  const board = getBoard(s, player);
  for (const card of board) {
    const def = getCardDef(card);
    if (!def.abilities) continue;
    for (let i = 0; i < def.abilities.length; i++) {
      const ability = def.abilities[i];
      if (ability.timing === timing) {
        events.push({ type: 'ability_triggered', cardInstanceId: card.instanceId, abilityIndex: i, timing });
        const result = resolveAbility(s, player, card.instanceId, ability, i, context.triggeringCardId);
        s = result.state;
        events.push(...result.events);
      }
    }
  }

  return { state: s, events };
}
