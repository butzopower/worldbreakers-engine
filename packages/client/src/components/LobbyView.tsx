import { useState, useEffect } from 'react';
import { socket } from '../socket.js';
import type { GameInfo } from '../types.js';

export default function LobbyView() {
  const [games, setGames] = useState<GameInfo[]>([]);

  useEffect(() => {
    socket.emit('list_games');

    socket.on('lobby_update', ({ games }) => {
      setGames(games);
    });

    return () => {
      socket.off('lobby_update');
    };
  }, []);

  const createGame = () => {
    socket.emit('create_game', {});
  };

  const joinGame = (gameId: string) => {
    socket.emit('join_game', { gameId });
  };

  return (
    <div>
      <h2 style={{ fontSize: '16px', marginBottom: '12px' }}>Lobby</h2>

      <button
        onClick={createGame}
        style={{
          background: '#e94560', color: 'white', border: 'none',
          padding: '8px 16px', cursor: 'pointer', borderRadius: '4px',
          fontSize: '14px', marginBottom: '16px',
        }}
      >
        Create Game
      </button>

      <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Open Games</h3>
      {games.length === 0 ? (
        <p style={{ color: '#888' }}>No open games. Create one!</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {games.map(g => (
            <li key={g.gameId} style={{ marginBottom: '8px' }}>
              <span>{g.gameId}</span>
              <button
                onClick={() => joinGame(g.gameId)}
                style={{
                  background: '#0f3460', color: 'white', border: 'none',
                  padding: '4px 12px', cursor: 'pointer', borderRadius: '4px',
                  marginLeft: '8px', fontSize: '12px',
                }}
              >
                Join
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
