import { useState, useEffect } from 'react';
import { socket } from '../socket';
import type { GameInfo } from '../types';
import styles from './LobbyView.module.css';

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
      <h2 className={styles.title}>Lobby</h2>

      <button onClick={createGame} className={styles.createBtn}>
        Create Game
      </button>

      <h3 className={styles.sectionTitle}>Open Games</h3>
      {games.length === 0 ? (
        <p className={styles.emptyMessage}>No open games. Create one!</p>
      ) : (
        <ul className={styles.gameList}>
          {games.map(g => (
            <li key={g.gameId} className={styles.gameItem}>
              <span>{g.gameId}</span>
              <button onClick={() => joinGame(g.gameId)} className={styles.joinBtn}>
                Join
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
