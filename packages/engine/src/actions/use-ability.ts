import { PlayerId } from '../types/core.js';
import { GameState } from '../types/state.js';
import { GameEvent } from '../types/events.js';
import { getCard, getCardDef } from '../state/query.js';
import { exhaustCard } from '../state/mutate.js';
import { resolveAbility } from '../abilities/resolver.js';
import { runCleanup } from '../engine/cleanup.js';

export function handleUseAbility(
  state: GameState,
  player: PlayerId,
  cardInstanceId: string,
  abilityIndex: number,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];
  const card = getCard(s, cardInstanceId)!;
  const def = getCardDef(card);

  // Exhaust the card if it's a follower (worldbreakers don't exhaust for abilities)
  if (def.type === 'follower') {
    const exhaustResult = exhaustCard(s, cardInstanceId);
    s = exhaustResult.state;
    events.push(...exhaustResult.events);
  }

  // Mark ability as used this turn
  s = {
    ...s,
    cards: s.cards.map(c =>
      c.instanceId === cardInstanceId
        ? { ...c, usedAbilities: [...c.usedAbilities, abilityIndex] }
        : c
    ),
  };

  // Resolve the ability
  const ability = def.abilities![abilityIndex];
  events.push({ type: 'ability_triggered', cardInstanceId, abilityIndex, timing: ability.timing });

  const abilityResult = resolveAbility(s, player, cardInstanceId, ability, abilityIndex);
  s = abilityResult.state;
  events.push(...abilityResult.events);

  // Cleanup
  const cleanupResult = runCleanup(s);
  s = cleanupResult.state;
  events.push(...cleanupResult.events);

  return { state: s, events };
}
