import { Guild, StandingGuild } from './core';
import { AbilityDefinition, Condition } from './effects';

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
  /** Bloodshed damage amount, if keyword is present */
  bloodshedAmount?: number;
  /** Standing requirement: { guild: count } */
  standingRequirement?: Partial<Record<StandingGuild, number>>;
  abilities?: AbilityDefinition[];
  /** Static effects that are active while this card is on the board */
  passiveEffects?: PassiveEffectDefinition[];
  /** Restrictions on which followers can block this attacker */
  blockRestrictions?: BlockRestriction[];
  /** Optional card description shown on hover in the UI */
  description?: string;
}
