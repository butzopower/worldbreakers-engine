import { Guild, StandingGuild, PlayerId, Zone } from './core';
import { CounterType } from './counters';
import { CardType, Keyword } from './cards';
import { CombatResponseTrigger, LastingEffectExpiration, LastingEffectType } from "./state";

export type PlayerSelector = 'self' | 'opponent' | 'both' | 'active' | 'controller';

export interface CardFilter {
  type?: CardType | CardType[];
  guild?: Guild | Guild[];
  zone?: Zone | Zone[];
  owner?: PlayerSelector;
  keyword?: Keyword;
  notKeyword?: Keyword;
  excludeSelf?: boolean;
  canPay?: { costReduction?: number };
  cardInstanceIds?: string[];
  /** Filter by printed (base) cost */
  maxCost?: number;
  /** Filter to only wounded followers (wound counter > 0) */
  wounded?: boolean;
}

export type TargetSelector =
  | { kind: 'self' }
  | { kind: 'all'; filter: CardFilter }
  | { kind: 'choose'; filter: CardFilter; count: number }
  | { kind: 'triggering_card' }
  | { kind: 'source_card' };

export type Condition =
  | { type: 'min_card_count'; filter: CardFilter; count: number }
  | { type: 'attacking_alone' }
  | { type: 'standing_less_than'; guild: StandingGuild; amount: number }
  | { type: 'any_standing_at_least'; amount: number };

export interface Mode {
  label: string;
  effects: EffectPrimitive[];
}

export type EffectPrimitive =
  | { type: 'gain_mythium'; player: PlayerSelector; amount: number }
  | { type: 'draw_cards'; player: PlayerSelector; count: number }
  | { type: 'gain_standing'; player: PlayerSelector; guild: StandingGuild | 'choose'; amount: number }
  | { type: 'gain_power'; player: PlayerSelector; amount: number }
  | { type: 'deal_wounds'; target: TargetSelector; amount: number }
  | { type: 'add_counter'; target: TargetSelector; counter: CounterType; amount: number }
  | { type: 'remove_counter'; target: TargetSelector; counter: CounterType; amount: number }
  | { type: 'discard'; player: PlayerSelector; count: number }
  | { type: 'exhaust'; target: TargetSelector }
  | { type: 'ready'; target: TargetSelector }
  | { type: 'buff_attackers'; counter: 'strength_buff'; amount: number }
  | { type: 'choose_one'; modes: Mode[] }
  | { type: 'play_card'; target: TargetSelector; costReduction?: number }
  | { type: 'conditional'; condition: Condition; effects: EffectPrimitive[] }
  | { type: 'develop'; target: TargetSelector }
  | { type: 'initiate_attack' }
  | { type: 'lose_standing'; player: PlayerSelector; guild: StandingGuild; amount: number }
  | { type: 'migrate'; effects: EffectPrimitive[] }
  | { type: 'grant_lasting_effect'; target: TargetSelector; effect: LastingEffectType; amount?: number; expiresAt: LastingEffectExpiration }
  | { type: 'destroy'; target: TargetSelector }
  | { type: 'register_combat_response'; trigger: CombatResponseTrigger; effects: EffectPrimitive[] };

export type AbilityTiming =
  | 'enters'
  | 'play'
  | 'action'
  | 'rally'
  | 'attacks'
  | 'your_attack'
  | 'blocks'
  | 'breach'
  | 'interrupt'
  | 'response'
  | 'follower_defeated'
  | 'location_depleted'
  | 'overwhelms';

export interface AbilityDefinition {
  timing: AbilityTiming;
  effects?: EffectPrimitive[];
  customResolve?: string;
  /** If true, the ability is mandatory (no player choice to activate) */
  forced?: boolean;
  /** Description for UI display */
  description?: string;
}
