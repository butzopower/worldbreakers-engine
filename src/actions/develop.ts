import { PlayerId } from '../types/core.js';
import { GameState } from '../types/state.js';
import { GameEvent } from '../types/events.js';
import { getCard, getCardDef, getLocationStage } from '../state/query.js';
import { removeCounterFromCard } from '../state/mutate.js';
import { runCleanup } from '../engine/cleanup.js';
import { resolveAbility } from '../abilities/resolver.js';

export function handleDevelop(
  state: GameState,
  player: PlayerId,
  locationInstanceId: string,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  // Remove one stage counter
  const removeResult = removeCounterFromCard(s, locationInstanceId, 'stage', 1);
  s = removeResult.state;
  events.push(...removeResult.events);

  // Determine which stage we just revealed
  const card = getCard(s, locationInstanceId)!;
  const def = getCardDef(card);
  const currentStage = getLocationStage(card);
  // After removing a counter, the stage number is the one we just developed to
  // Stage = stages - remaining + 1, but we already removed a counter
  // so the currentStage already reflects the developed stage
  const developedStage = currentStage - 1; // The stage we resolve is one before current

  events.push({ type: 'location_developed', locationInstanceId, stage: developedStage });

  // Resolve the stage ability
  if (def.locationStages) {
    const stageAbility = def.locationStages.find(ls => ls.stage === developedStage);
    if (stageAbility) {
      const abilityResult = resolveAbility(s, player, locationInstanceId, stageAbility.ability, 0);
      s = abilityResult.state;
      events.push(...abilityResult.events);
    }
  }

  // Run cleanup (handles depletion)
  const cleanupResult = runCleanup(s);
  s = cleanupResult.state;
  events.push(...cleanupResult.events);

  return { state: s, events };
}
