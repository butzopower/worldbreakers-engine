import { PlayerId, StandingGuild, Phase, Zone, CombatStep } from './core.js';
import { CounterMap } from './counters.js';
import { AbilityTiming } from './effects.js';

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  owner: PlayerId;
  zone: Zone;
  exhausted: boolean;
  counters: CounterMap;
  /** Tracks which "Action:" abilities have been used this turn */
  usedAbilities: number[];
}

export interface LastingEffect {
  id: string;
  /** Which counter type or buff applies */
  type: 'strength_buff' | 'health_buff';
  amount: number;
  /** Cards affected */
  targetInstanceIds: string[];
  /** When does this expire? */
  expiresAt: 'end_of_combat' | 'end_of_turn' | 'end_of_round';
}

export interface CombatState {
  step: CombatStep;
  attackingPlayer: PlayerId;
  attackerIds: string[];
  /** Map from blocker instanceId → attacker instanceId it's blocking */
  blockerAssignments: Record<string, string>;
  /** Attackers that have been blocked */
  blockedAttackerIds: string[];
  /** Damage already dealt during fight */
  damageDealt: boolean;
}

export interface PendingChoice {
  type: 'choose_blockers' | 'choose_target' | 'choose_discard' | 'choose_breach_target';
  playerId: PlayerId;
  /** Context for the choice */
  context: Record<string, unknown>;
}

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
}
