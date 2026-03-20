import { PlayerId, StandingGuild, Phase, Zone, CombatStep } from './core';
import { CostDiscount } from './cards';
import { CounterMap } from './counters';
import { CardFilter, EffectPrimitive, Mode } from './effects';
import { EngineStep } from './steps';

export type CombatResponseTrigger = 'on_power_gain';

export interface CombatResponse {
  id: string;
  trigger: CombatResponseTrigger;
  effects: EffectPrimitive[];
  controller: PlayerId;
  sourceCardId: string;
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  owner: PlayerId;
  zone: Zone;
  exhausted: boolean;
  counters: CounterMap;
  markAsDestroyed: boolean;
}

export type LastingEffectType = 'strength_buff' | 'health_buff' | 'lethal' | 'overwhelm' | 'unblockable' | 'cant_block' | 'no_attacks' | 'boost_ruknuddin_khurshah_ability';
export type LastingEffectExpiration = 'end_of_combat' | 'end_of_turn' | 'end_of_round';

export interface LastingEffect {
  id: string;
  /** Which counter type or buff applies */
  type: LastingEffectType;
  amount: number;
  /** Cards affected */
  targetInstanceIds: string[];
  /** When does this expire? */
  expiresAt: LastingEffectExpiration;
}

export interface CombatState {
  step: CombatStep;
  attackingPlayer: PlayerId;
  attackerIds: string[];
}

export type PendingChoiceChooseTarget = { type: 'choose_target'; playerId: PlayerId; sourceCardId: string; abilityIndex: number; effects: EffectPrimitive[]; filter: CardFilter; triggeringCardId?: string }

export interface TriggerOption {
  sourceCardId: string;
  abilityIndex: number;
  triggeringCardId?: string;
  forced: boolean;
}

export type PendingChoice =
  | { type: 'choose_blockers'; playerId: PlayerId; attackerIds: string[] }
  | PendingChoiceChooseTarget
  | { type: 'choose_discard'; playerId: PlayerId; count: number; sourceCardId: string }
  | { type: 'choose_breach_target'; playerId: PlayerId; validLocationIds: string[] }
  | { type: 'choose_mode'; playerId: PlayerId; sourceCardId: string; modes: Mode[] }
  | { type: 'choose_attackers'; playerId: PlayerId; maxAttackers?: number }
  | { type: 'choose_trigger_order'; playerId: PlayerId; triggers: TriggerOption[] }
  | { type: 'choose_cost_discount'; playerId: PlayerId; cardInstanceId: string; costDiscount: CostDiscount; externalCostReduction: number; validTargetIds: string[] }
  | { type: 'choose_play_order'; playerId: PlayerId; cardInstanceIds: string[] }
  | { type: 'choose_mulligan'; playerId: PlayerId };

export interface PlayerState {
  mythium: number;
  power: number;
  standing: Record<StandingGuild, number>;
  handSize: number;
  bonusActions: number;
  pendingBonusActions: number;
  powerGainedThisRound: boolean;
  soloAttackedThisRound: boolean;
}

export interface GameState {
  /** Monotonically increasing for state versioning */
  version: number;
  phase: Phase;
  round: number;
  /** Number of actions taken this round (max 8 = 4 per player) */
  actionsTaken: number;
  /** Which player goes first this round (alternates each round) */
  firstPlayer: PlayerId;
  /** Whose turn it currently is to act */
  activePlayer: PlayerId;
  players: Record<PlayerId, PlayerState>;
  cards: CardInstance[];
  combat: CombatState | null;
  pendingChoice: PendingChoice | null;
  lastingEffects: LastingEffect[];
  /** Seeded RNG state for reproducibility */
  rngState: number;
  /** Winner, if game is over */
  winner: PlayerId | 'draw' | null;
  /** Combat responses registered by cards, fire once during combat */
  combatResponses: CombatResponse[];
  /** Instance IDs of followers defeated this round */
  defeatedThisRound: string[];
  /** Step queue for the queue-based engine lifecycle */
  stepQueue: EngineStep[] | null;
}
