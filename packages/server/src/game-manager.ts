import { GameSession } from './game-session';
import type { DeckConfig, PlayerId } from '@worldbreakers/engine';
import type { GameInfo } from './types';

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // check every minute

let nextGameId = 1;

export class GameManager {
  private games = new Map<string, GameSession>();
  private socketToGame = new Map<string, string>();
  private cleanupTimer: ReturnType<typeof setInterval>;
  private onGameRemoved?: (gameId: string, session: GameSession) => void;

  constructor(opts?: { onGameRemoved?: (gameId: string, session: GameSession) => void }) {
    this.onGameRemoved = opts?.onGameRemoved;
    this.cleanupTimer = setInterval(() => this.cleanupInactiveGames(), CLEANUP_INTERVAL_MS);
  }

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

  private cleanupInactiveGames(): void {
    const now = Date.now();
    for (const [gameId, session] of this.games) {
      if (now - session.lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
        console.log(`Removing inactive game ${gameId} (no activity for 10 minutes)`);
        // Clean up socket mappings for connected players
        for (const p of ['player1', 'player2'] as PlayerId[]) {
          const sid = session.getSocketId(p);
          if (sid) {
            this.socketToGame.delete(sid);
          }
        }
        this.onGameRemoved?.(gameId, session);
        this.games.delete(gameId);
      }
    }
  }

  stopCleanup(): void {
    clearInterval(this.cleanupTimer);
  }
}
