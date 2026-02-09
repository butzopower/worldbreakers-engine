import { Guild, StandingGuild } from './core.js';
import { AbilityDefinition } from './effects.js';

export type CardType = 'worldbreaker' | 'follower' | 'event' | 'location';

export type Keyword =
  | 'stationary'
  | 'bloodshed'
  | 'hidden'
  | 'overwhelm';

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
  /** Bloodshed damage amount, if keyword is present */
  bloodshedAmount?: number;
  /** Standing requirement: { guild: count } */
  standingRequirement?: Partial<Record<StandingGuild, number>>;
  abilities?: AbilityDefinition[];
}
