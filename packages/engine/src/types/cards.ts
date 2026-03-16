import { Guild, StandingGuild } from './core';
import { AbilityDefinition, CardFilter, Condition } from './effects';

export type CardType = 'worldbreaker' | 'follower' | 'event' | 'location';

export type BlockRestriction =
  | { type: 'wounded_blocker' }
  | { type: 'min_blocker_strength'; value: number };

export type PassiveEffectDefinition =
  | { type: 'cost_reduction'; cardTypes: CardType[]; amount: number }
  | { type: 'draw_aggro' };

export type Keyword =
  | 'stationary'
  | 'bloodshed'
  | 'hidden'
  | 'overwhelm'
  | 'lethal';

export type CostDiscountTargetEffect =
  | { type: 'remove_counter'; counter: 'stage'; amount: number }
  | { type: 'reveal' };

export interface CostDiscount {
  /** Filter to find valid targets for the discount */
  filter: CardFilter;
  /** Mythium reduction amount */
  costReduction: number;
  /** If true, reduction is per target selected (vs flat) */
  perTarget?: boolean;
  /** Max targets to select */
  maxTargets?: number;
  /** What happens to each selected target */
  targetEffect: CostDiscountTargetEffect;
}

export interface LocationStage {
  stage: number;
  ability: AbilityDefinition;
}

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  guild: Guild;
  cost: number;
  strength?: number;
  health?: number;
  stages?: number;
  locationStages?: LocationStage[];
  keywords?: Keyword[];
  conditionalKeywords?: Array<{
    keyword: Keyword;
    condition: Condition;
  }>;
  /** Standing requirement: { guild: count } */
  standingRequirement?: Partial<Record<StandingGuild, number>>;
  abilities?: AbilityDefinition[];
  /** Static effects that are active while this card is on the board */
  passiveEffects?: PassiveEffectDefinition[];
  /** Restrictions on which followers can block this attacker */
  blockRestrictions?: BlockRestriction[];
  /** Optional card description shown on hover in the UI */
  description?: string;
  /** Optional cost discount: player can take an action before paying to reduce cost */
  costDiscount?: CostDiscount;
}
