import { PlayerId } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { getCard, getCardDef, getLocationStage } from '../state/query';
import { removeCounterFromCard } from '../state/mutate';
import { EngineStep } from "../types/steps";
import { StepResult } from "../engine/step-handlers";
import { runCleanup } from "../engine/cleanup";

export function handleDevelop(
  state: GameState,
  player: PlayerId,
  locationInstanceId: string,
): StepResult {
  let s = state;
  const events: GameEvent[] = [];
  const prepend: EngineStep[] = [];

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
      prepend.push(
        {
          type: 'resolve_ability',
          controller: player,
          sourceCardId: locationInstanceId,
          ability: stageAbility.ability
        }
      )
    }
  }

  // Run cleanup (handles depletion)
  // TODO: figure out why this needs to be called here rather than just pushing a cleanup step
  const cleanupResult = runCleanup(s);
  s = cleanupResult.state;
  events.push(...cleanupResult.events);

  prepend.push({ type: 'cleanup' })

  return { state: s, events, prepend };
}
