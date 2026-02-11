import { PlayerId } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { getCard, getCardDef } from '../state/query';
import { spendMythium, moveCard, addCounterToCard } from '../state/mutate';
import { runCleanup } from '../engine/cleanup';
import { resolveAbility } from '../abilities/resolver';

export function handlePlayCard(
  state: GameState,
  player: PlayerId,
  cardInstanceId: string,
  opts?: { costReduction?: number },
): { state: GameState; events: GameEvent[] } {
  const card = getCard(state, cardInstanceId)!;
  const def = getCardDef(card);
  const events: GameEvent[] = [];
  let s = state;

  // Pay mythium cost
  const actualCost = Math.max(0, def.cost - (opts?.costReduction ?? 0));
  if (actualCost > 0) {
    const payResult = spendMythium(s, player, actualCost);
    s = payResult.state;
    events.push(...payResult.events);
  }

  if (def.type === 'event') {
    // Events go to discard after resolving
    const moveResult = moveCard(s, cardInstanceId, 'discard');
    s = moveResult.state;
    events.push(...moveResult.events);
    events.push({ type: 'card_played', player, cardInstanceId, definitionId: def.id });

    // Resolve enters abilities
    if (def.abilities) {
      for (let i = 0; i < def.abilities.length; i++) {
        const ability = def.abilities[i];
        if (ability.timing === 'enters') {
          const abilityResult = resolveAbility(s, player, cardInstanceId, ability, i);
          s = abilityResult.state;
          events.push(...abilityResult.events);
        }
      }
    }
  } else if (def.type === 'location') {
    // Location enters board with stage counters
    const moveResult = moveCard(s, cardInstanceId, 'board');
    s = moveResult.state;
    events.push(...moveResult.events);
    events.push({ type: 'card_played', player, cardInstanceId, definitionId: def.id });

    if (def.stages && def.stages > 0) {
      const counterResult = addCounterToCard(s, cardInstanceId, 'stage', def.stages);
      s = counterResult.state;
      events.push(...counterResult.events);
    }
  } else {
    // Followers enter board
    const moveResult = moveCard(s, cardInstanceId, 'board');
    s = moveResult.state;
    events.push(...moveResult.events);
    events.push({ type: 'card_played', player, cardInstanceId, definitionId: def.id });

    // Resolve enters abilities
    if (def.abilities) {
      for (let i = 0; i < def.abilities.length; i++) {
        const ability = def.abilities[i];
        if (ability.timing === 'enters') {
          const abilityResult = resolveAbility(s, player, cardInstanceId, ability, i);
          s = abilityResult.state;
          events.push(...abilityResult.events);
        }
      }
    }
  }

  // Run cleanup after play
  const cleanupResult = runCleanup(s);
  s = cleanupResult.state;
  events.push(...cleanupResult.events);

  return { state: s, events };
}
