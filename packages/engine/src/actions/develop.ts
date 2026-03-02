import { PlayerId } from '../types/core';
import { GameState } from '../types/state';
import { getCard, getCardDef, getLocationStage } from '../state/query';
import { EngineStep } from "../types/steps";

export function handleDevelop(
  state: GameState,
  player: PlayerId,
  locationInstanceId: string,
): EngineStep[] {
  const card = getCard(state, locationInstanceId)!;
  const def = getCardDef(card);

  // The developed stage is the current stage (before counter removal)
  const developedStage = getLocationStage(card);

  const steps: EngineStep[] = [
    { type: 'remove_counter', cardInstanceId: locationInstanceId, counter: 'stage', amount: 1 },
    { type: 'location_developed', locationInstanceId, stage: developedStage },
    // Run cleanup first to handle depletion (location with 0 stage counters)
    { type: 'cleanup' },
  ];

  // Then resolve the stage ability (runs after the location may have been depleted)
  if (def.locationStages) {
    const stageAbility = def.locationStages.find(ls => ls.stage === developedStage);
    if (stageAbility) {
      steps.push(
        {
          type: 'resolve_ability',
          controller: player,
          sourceCardId: locationInstanceId,
          ability: stageAbility.ability,
        },
        { type: 'cleanup' },
      );
    }
  }

  return steps;
}
