import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameManager } from './game-manager.js';
import type { ServerToClientEvents, ClientToServerEvents, ClientCardDefinition } from './types.js';
import { getAllCardDefinitions } from '@worldbreakers/engine';
import type { PlayerId } from '@worldbreakers/engine';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

const manager = new GameManager();

function buildClientCardDefs(): Record<string, ClientCardDefinition> {
  const defs: Record<string, ClientCardDefinition> = {};
  for (const def of getAllCardDefinitions()) {
    const description = def.abilities?.[0]?.description;
    defs[def.id] = {
      id: def.id,
      name: def.name,
      type: def.type,
      guild: def.guild,
      cost: def.cost,
      ...(def.strength !== undefined && { strength: def.strength }),
      ...(def.health !== undefined && { health: def.health }),
      ...(def.stages !== undefined && { stages: def.stages }),
      ...(def.keywords?.length && { keywords: def.keywords }),
      ...(def.standingRequirement && { standingRequirement: def.standingRequirement as Record<string, number> }),
      ...(description && { description }),
    };
  }
  return defs;
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('list_games', () => {
    socket.emit('lobby_update', { games: manager.getOpenGames() });
  });

  socket.on('create_game', ({ deck } = {}) => {
    const session = manager.createGame(socket.id, deck);
    socket.join(session.gameId);
    socket.emit('game_created', { gameId: session.gameId, playerId: 'player1' });
    // Broadcast updated lobby to everyone
    io.emit('lobby_update', { games: manager.getOpenGames() });
    console.log(`Game ${session.gameId} created by ${socket.id}`);
  });

  socket.on('join_game', ({ gameId, deck }) => {
    const session = manager.joinGame(gameId, socket.id, deck);
    if (!session) {
      socket.emit('error', { message: 'Game not found or already full' });
      return;
    }

    socket.join(gameId);
    console.log(`Game ${gameId} joined by ${socket.id}`);

    // Send game_started to both players
    const p1Socket = session.getSocketId('player1');
    const p2Socket = session.getSocketId('player2');

    const cardDefinitions = buildClientCardDefs();

    if (p1Socket) {
      io.to(p1Socket).emit('game_started', {
        state: session.getFilteredState('player1'),
        legalActions: session.getLegalActionsForPlayer('player1'),
        cardDefinitions,
      });
    }
    if (p2Socket) {
      io.to(p2Socket).emit('game_started', {
        state: session.getFilteredState('player2'),
        legalActions: session.getLegalActionsForPlayer('player2'),
        cardDefinitions,
      });
    }

    // Remove from lobby
    io.emit('lobby_update', { games: manager.getOpenGames() });
  });

  socket.on('submit_action', ({ action }) => {
    const session = manager.getGameBySocket(socket.id);
    if (!session) {
      socket.emit('error', { message: 'Not in a game' });
      return;
    }

    const player = session.getPlayerBySocket(socket.id);
    if (!player) {
      socket.emit('error', { message: 'Not a player in this game' });
      return;
    }

    try {
      const result = session.submitAction(player, action);

      // Send updated state to both players
      for (const p of ['player1', 'player2'] as PlayerId[]) {
        const sid = session.getSocketId(p);
        if (!sid) continue;

        const filteredState = session.getFilteredState(p);
        const legalActions = session.getLegalActionsForPlayer(p);

        io.to(sid).emit('game_state', {
          state: filteredState,
          legalActions,
          events: result.events,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      socket.emit('error', { message });
      console.error(`Action error in ${session.gameId}:`, message);
    }
  });

  socket.on('disconnect', () => {
    const result = manager.handleDisconnect(socket.id);
    if (result) {
      const { session, disconnectedPlayer } = result;
      const opponent: PlayerId = disconnectedPlayer === 'player1' ? 'player2' : 'player1';
      const opponentSocket = session.getSocketId(opponent);
      if (opponentSocket) {
        io.to(opponentSocket).emit('opponent_disconnected');
      }
    }
    console.log(`Player disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Worldbreakers server running on port ${PORT}`);
});
