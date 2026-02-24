import {
  createGameState, processAction, getLegalActions, registerTestCards, registerSetCards,
  type GameState, type PlayerId, type PlayerAction, type ActionInput,
  type GameEvent, type PendingChoice, type DeckConfig,
} from '@worldbreakers/engine';
import type { FilteredGameState, FilteredCard, HiddenCard } from './types';
import { atokEarth } from "./preconstructs";

const DEFAULT_DECK = atokEarth;

// Ensure test cards are registered
let cardsRegistered = false;
function ensureCardsRegistered() {
  if (!cardsRegistered) {
    registerTestCards();
    registerSetCards();
    cardsRegistered = true;
  }
}

export class GameSession {
  readonly gameId: string;
  private state: GameState;
  private playerSocketIds: Record<PlayerId, string | null> = {
    player1: null,
    player2: null,
  };

  constructor(
    gameId: string,
    player1SocketId: string,
    player1Deck?: DeckConfig,
    player2Deck?: DeckConfig,
  ) {
    ensureCardsRegistered();
    this.gameId = gameId;
    this.playerSocketIds.player1 = player1SocketId;
    this.state = createGameState({
      player1Deck: player1Deck ?? DEFAULT_DECK,
      player2Deck: player2Deck ?? DEFAULT_DECK,
      seed: Date.now(),
    });
  }

  joinPlayer2(socketId: string): void {
    this.playerSocketIds.player2 = socketId;
  }

  getPlayerBySocket(socketId: string): PlayerId | null {
    if (this.playerSocketIds.player1 === socketId) return 'player1';
    if (this.playerSocketIds.player2 === socketId) return 'player2';
    return null;
  }

  getSocketId(player: PlayerId): string | null {
    return this.playerSocketIds[player];
  }

  isFull(): boolean {
    return this.playerSocketIds.player1 !== null && this.playerSocketIds.player2 !== null;
  }

  getState(): GameState {
    return this.state;
  }

  getFilteredState(forPlayer: PlayerId): FilteredGameState {
    const opponent: PlayerId = forPlayer === 'player1' ? 'player2' : 'player1';

    const filteredCards: FilteredCard[] = this.state.cards.map(card => {
      if (card.zone === 'deck' || (card.zone === 'hand' && card.owner === opponent)) {
        return { hidden: true, owner: card.owner, zone: card.zone } satisfies HiddenCard;
      }
      return {
        instanceId: card.instanceId,
        definitionId: card.definitionId,
        owner: card.owner,
        zone: card.zone,
        exhausted: card.exhausted,
        counters: { ...card.counters },
        usedAbilities: [...card.usedAbilities],
      };
    });

    return {
      version: this.state.version,
      phase: this.state.phase,
      round: this.state.round,
      actionsTaken: this.state.actionsTaken,
      firstPlayer: this.state.firstPlayer,
      activePlayer: this.state.activePlayer,
      players: this.state.players,
      cards: filteredCards,
      combat: this.state.combat,
      pendingChoice: this.state.pendingChoice,
      lastingEffects: this.state.lastingEffects,
      winner: this.state.winner,
    };
  }

  getLegalActionsForPlayer(player: PlayerId): PlayerAction[] {
    const allActions = getLegalActions(this.state);
    return allActions
      .filter(a => a.player === player)
      .map(a => a.action);
  }

  submitAction(player: PlayerId, action: PlayerAction): {
    state: GameState;
    events: GameEvent[];
    waitingFor?: PendingChoice;
  } {
    const input: ActionInput = { player, action };
    const result = processAction(this.state, input);
    this.state = result.state;
    return result;
  }

  handleDisconnect(socketId: string): PlayerId | null {
    const player = this.getPlayerBySocket(socketId);
    if (player) {
      this.playerSocketIds[player] = null;
    }
    return player;
  }
}
