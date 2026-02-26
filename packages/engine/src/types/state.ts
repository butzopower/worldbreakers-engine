import { PlayerId, StandingGuild, Phase, Zone, CombatStep } from './core';
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
  /** Tracks which "Action:" abilities have been used this turn */
  usedAbilities: number[];
  markAsDestroyed: boolean;
}

export type LastingEffectType = 'strength_buff' | 'health_buff' | 'lethal' | 'overwhelm' | 'unblockable';
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

export type PendingChoice =
  | { type: 'choose_blockers'; playerId: PlayerId; attackerIds: string[] }
  | PendingChoiceChooseTarget
  | { type: 'choose_discard'; playerId: PlayerId; count: number; sourceCardId: string }
  | { type: 'choose_breach_target'; playerId: PlayerId; validLocationIds: string[] }
  | { type: 'choose_mode'; playerId: PlayerId; sourceCardId: string; modes: Mode[] }
  | { type: 'choose_attackers'; playerId: PlayerId };

export interface PlayerState {
  mythium: number;
  power: number;
  standing: Record<StandingGuild, number>;
  handSize: number;
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
  /** Effects remaining to resolve after the current pending choice completes */
  remainingEffects?: { effects: EffectPrimitive[]; controller: PlayerId; sourceCardId: string; triggeringCardId?: string };
  /** Step queue for the queue-based engine lifecycle */
  stepQueue: EngineStep[] | null;
}
