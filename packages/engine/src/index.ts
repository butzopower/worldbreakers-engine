// Public API
export { processAction, getLegalActions } from './engine/engine';
export type { ProcessResult } from './engine/engine';

export { createGameState } from './state/create';
export type { GameConfig, DeckConfig } from './state/create';

export { registerCard, getCardDefinition, getAllCardDefinitions } from './cards/registry';
export { registerTestCards } from './cards/test-cards';
export { registerSetCards } from './cards/sets';

// Types
export type { PlayerId, Guild, StandingGuild, Phase, Zone, CombatStep, RallyStep } from './types/core';
export { opponentOf, PLAYERS, STANDING_GUILDS } from './types/core';
export type { CardDefinition, CardType, Keyword, LocationStage } from './types/cards';
export type { GameState, PlayerState, CardInstance, CombatState, LastingEffect, PendingChoice } from './types/state';
export type { PlayerAction, ActionInput } from './types/actions';
export type { GameEvent } from './types/events';
export type { EffectPrimitive, AbilityDefinition, AbilityTiming, TargetSelector, PlayerSelector, CardFilter } from './types/effects';
export type { CounterType, CounterMap } from './types/counters';

// State queries
export {
  getCard, getCardDef, getCardsInZone, getBoard, getHand, getDeck,
  getWorldbreaker, getFollowers, getLocations,
  getBaseStrength, getBaseHealth, getEffectiveStrength, getEffectiveHealth,
  isDefeated, hasKeyword, canAttack, canBlock, canBlockAttacker,
  isLocationDepleted, getLocationStage,
  canPlayCard, canDevelop, canUseAbility,
} from './state/query';

// Custom ability registration
export { registerCustomResolver } from './abilities/system';
