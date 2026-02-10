import type { PlayerId, GameState, PlayerAction, PendingChoice, ActionInput, GameEvent, DeckConfig } from '@worldbreakers/engine';

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

export interface GameInfo {
  gameId: string;
  creatorName: string;
  createdAt: number;
}

export interface ServerToClientEvents {
  game_created: (data: { gameId: string; playerId: PlayerId }) => void;
  game_started: (data: { state: FilteredGameState; legalActions: PlayerAction[]; cardDefinitions: Record<string, ClientCardDefinition> }) => void;
  game_state: (data: { state: FilteredGameState; legalActions: PlayerAction[]; events: GameEvent[] }) => void;
  waiting_for_input: (data: { pendingChoice: PendingChoice; legalActions: PlayerAction[] }) => void;
  lobby_update: (data: { games: GameInfo[] }) => void;
  error: (data: { message: string }) => void;
  opponent_disconnected: () => void;
}

export interface ClientToServerEvents {
  create_game: (data: { deck?: DeckConfig }) => void;
  join_game: (data: { gameId: string; deck?: DeckConfig }) => void;
  list_games: () => void;
  submit_action: (data: { action: PlayerAction }) => void;
}

export interface HiddenCard {
  hidden: true;
  owner: PlayerId;
  zone: 'hand';
}

export type FilteredCard = {
  instanceId: string;
  definitionId: string;
  owner: PlayerId;
  zone: string;
  exhausted: boolean;
  counters: Record<string, number>;
  usedAbilities: number[];
} | HiddenCard;

export interface FilteredGameState {
  version: number;
  phase: string;
  round: number;
  actionsTaken: number;
  firstPlayer: PlayerId;
  activePlayer: PlayerId;
  players: GameState['players'];
  cards: FilteredCard[];
  combat: GameState['combat'];
  pendingChoice: GameState['pendingChoice'];
  lastingEffects: GameState['lastingEffects'];
  winner: GameState['winner'];
}
