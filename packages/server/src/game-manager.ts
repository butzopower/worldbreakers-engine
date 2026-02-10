import { GameSession } from './game-session';
import type { DeckConfig, PlayerId } from '@worldbreakers/engine';
import type { GameInfo } from './types';

let nextGameId = 1;

export class GameManager {
  private games = new Map<string, GameSession>();
  private socketToGame = new Map<string, string>();

  createGame(socketId: string, deck?: DeckConfig): GameSession {
    const gameId = `game_${nextGameId++}`;
    const session = new GameSession(gameId, socketId, deck);
    this.games.set(gameId, session);
    this.socketToGame.set(socketId, gameId);
    return session;
  }

  joinGame(gameId: string, socketId: string, deck?: DeckConfig): GameSession | null {
    const session = this.games.get(gameId);
    if (!session || session.isFull()) return null;
    session.joinPlayer2(socketId);
    this.socketToGame.set(socketId, gameId);
    return session;
  }

  getGameBySocket(socketId: string): GameSession | null {
    const gameId = this.socketToGame.get(socketId);
    if (!gameId) return null;
    return this.games.get(gameId) ?? null;
  }

  getOpenGames(): GameInfo[] {
    const open: GameInfo[] = [];
    for (const [, session] of this.games) {
      if (!session.isFull()) {
        open.push({
          gameId: session.gameId,
          creatorName: 'Player',
          createdAt: Date.now(),
        });
      }
    }
    return open;
  }

  handleDisconnect(socketId: string): { session: GameSession; disconnectedPlayer: PlayerId } | null {
    const gameId = this.socketToGame.get(socketId);
    if (!gameId) return null;

    const session = this.games.get(gameId);
    if (!session) return null;

    const disconnectedPlayer = session.handleDisconnect(socketId);
    this.socketToGame.delete(socketId);

    if (disconnectedPlayer) {
      return { session, disconnectedPlayer };
    }
    return null;
  }

  removeGame(gameId: string): void {
    this.games.delete(gameId);
  }
}
