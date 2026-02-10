import { Guild, StandingGuild, PlayerId, Zone } from './core';
import { CounterType } from './counters';
import { CardType, Keyword } from './cards';

export type PlayerSelector = 'self' | 'opponent' | 'both' | 'active' | 'controller';

export interface CardFilter {
  type?: CardType | CardType[];
  guild?: Guild | Guild[];
  zone?: Zone | Zone[];
  owner?: PlayerSelector;
  keyword?: Keyword;
  excludeSelf?: boolean;
}

export type TargetSelector =
  | { kind: 'self' }
  | { kind: 'all'; filter: CardFilter }
  | { kind: 'choose'; filter: CardFilter; count: number }
  | { kind: 'triggering_card' }
  | { kind: 'source_card' };

export type EffectPrimitive =
  | { type: 'gain_mythium'; player: PlayerSelector; amount: number }
  | { type: 'draw_cards'; player: PlayerSelector; count: number }
  | { type: 'gain_standing'; player: PlayerSelector; guild: StandingGuild; amount: number }
  | { type: 'gain_power'; player: PlayerSelector; amount: number }
  | { type: 'deal_wounds'; target: TargetSelector; amount: number }
  | { type: 'add_counter'; target: TargetSelector; counter: CounterType; amount: number }
  | { type: 'remove_counter'; target: TargetSelector; counter: CounterType; amount: number }
  | { type: 'discard'; player: PlayerSelector; count: number }
  | { type: 'exhaust'; target: TargetSelector }
  | { type: 'ready'; target: TargetSelector }
  | { type: 'buff_attackers'; counter: 'strength_buff'; amount: number };

export type AbilityTiming =
  | 'enters'
  | 'action'
  | 'rally'
  | 'attacks'
  | 'your_attack'
  | 'blocks'
  | 'breach'
  | 'interrupt'
  | 'response';

export interface AbilityDefinition {
  timing: AbilityTiming;
  effects?: EffectPrimitive[];
  customResolve?: string;
  /** If true, the ability is mandatory (no player choice to activate) */
  forced?: boolean;
  /** Description for UI display */
  description?: string;
}
