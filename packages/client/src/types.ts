export type PlayerId = 'player1' | 'player2';

export interface HiddenCard {
  hidden: true;
  owner: PlayerId;
  zone: 'hand';
}

export interface VisibleCard {
  instanceId: string;
  definitionId: string;
  owner: PlayerId;
  zone: string;
  exhausted: boolean;
  counters: Record<string, number>;
  usedAbilities: number[];
}

export type FilteredCard = VisibleCard | HiddenCard;

export function isVisible(card: FilteredCard): card is VisibleCard {
  return !('hidden' in card);
}

export interface PlayerState {
  mythium: number;
  power: number;
  standing: Record<string, number>;
  handSize: number;
}

export interface CombatState {
  step: string;
  attackingPlayer: PlayerId;
  attackerIds: string[];
  damageDealt: boolean;
}

export type PendingChoice =
  | { type: 'choose_blockers'; playerId: PlayerId; attackerIds: string[] }
  | { type: 'choose_target'; playerId: PlayerId; sourceCardId: string; abilityIndex: number; effects: unknown[]; triggeringCardId?: string }
  | { type: 'choose_discard'; playerId: PlayerId; count: number; sourceCardId: string; phase?: string; nextPhase?: string }
  | { type: 'choose_breach_target'; playerId: PlayerId; validLocationIds: string[] };

export interface FilteredGameState {
  version: number;
  phase: string;
  round: number;
  actionsTaken: number;
  firstPlayer: PlayerId;
  activePlayer: PlayerId;
  players: Record<PlayerId, PlayerState>;
  cards: FilteredCard[];
  combat: CombatState | null;
  pendingChoice: PendingChoice | null;
  lastingEffects: unknown[];
  winner: PlayerId | 'draw' | null;
}

export interface PlayerAction {
  type: string;
  [key: string]: unknown;
}

export interface GameInfo {
  gameId: string;
  creatorName: string;
  createdAt: number;
}

export interface GameEvent {
  type: string;
  [key: string]: unknown;
}

export interface ClientCardDefinition {
  id: string;
  name: string;
  type: string;
  guild: string;
  cost: number;
  strength?: number;
  health?: number;
  stages?: number;
  keywords?: string[];
  standingRequirement?: Record<string, number>;
  description?: string;
  cardDescription?: string;
  locationStages?: { stage: number; description?: string }[];
}

export type InteractionMode =
  | { type: 'none' }
  | { type: 'select_attackers'; selected: string[] }
  | { type: 'select_blocker'; selectedBlockerId: string | null; attackerIds: string[] }
  | { type: 'choose_target'; validTargets: string[] }
  | { type: 'choose_discard'; count: number; selected: string[] }
  | { type: 'choose_breach_target'; validLocations: string[] };
