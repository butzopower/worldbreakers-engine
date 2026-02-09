// Public API
export { processAction, getLegalActions } from './engine/engine.js';
export type { ProcessResult } from './engine/engine.js';

export { createGameState } from './state/create.js';
export type { GameConfig, DeckConfig } from './state/create.js';

export { registerCard, getCardDefinition, getAllCardDefinitions } from './cards/registry.js';
export { registerTestCards } from './cards/test-cards/index.js';

// Types
export type { PlayerId, Guild, StandingGuild, Phase, Zone, CombatStep, RallyStep } from './types/core.js';
export { opponentOf } from './types/core.js';
export type { CardDefinition, CardType, Keyword, LocationStage } from './types/cards.js';
export type { GameState, PlayerState, CardInstance, CombatState, LastingEffect, PendingChoice } from './types/state.js';
export type { PlayerAction, ActionInput } from './types/actions.js';
export type { GameEvent } from './types/events.js';
export type { EffectPrimitive, AbilityDefinition, AbilityTiming, TargetSelector, PlayerSelector, CardFilter } from './types/effects.js';
export type { CounterType, CounterMap } from './types/counters.js';

// State queries
export {
  getCard, getCardDef, getCardsInZone, getBoard, getHand, getDeck,
  getWorldbreaker, getFollowers, getLocations,
  getBaseStrength, getBaseHealth, getEffectiveStrength, getEffectiveHealth,
  isDefeated, hasKeyword, canAttack, canBlock,
  isLocationDepleted, getLocationStage,
  canPlayCard, canDevelop, canUseAbility,
} from './state/query.js';

// Custom ability registration
export { registerCustomResolver } from './abilities/system.js';
