import { useState, useEffect } from 'react';
import { socket } from './socket';
import LobbyView from './components/LobbyView';
import GameView from './components/GameView';
import { CardDefinitionsProvider } from './context/CardDefinitions';
import type { PlayerId, FilteredGameState, PlayerAction, GameEvent, ClientCardDefinition } from './types';
import styles from './App.module.css';

type AppState =
  | { screen: 'lobby' }
  | { screen: 'waiting'; gameId: string }
  | { screen: 'game'; gameId: string; playerId: PlayerId; state: FilteredGameState; legalActions: PlayerAction[]; events: GameEvent[] };

export default function App() {
  const [appState, setAppState] = useState<AppState>({ screen: 'lobby' });
  const [cardDefinitions, setCardDefinitions] = useState<Record<string, ClientCardDefinition>>({});
  const [error, setError] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    socket.connect();

    socket.on('game_created', ({ gameId, playerId }) => {
      setAppState({ screen: 'waiting', gameId });
    });

    socket.on('game_started', ({ state, legalActions, cardDefinitions: defs }) => {
      setCardDefinitions(defs);
      setAppState(prev => {
        const gameId = prev.screen === 'waiting' ? prev.gameId :
          prev.screen === 'game' ? prev.gameId : '';
        const playerId = getPlayerId(state);
        return { screen: 'game', gameId, playerId, state, legalActions, events: [] };
      });
    });

    socket.on('game_state', ({ state, legalActions, events }) => {
      setAppState(prev => {
        if (prev.screen !== 'game') return prev;
        return { ...prev, state, legalActions, events };
      });
    });

    socket.on('error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    socket.on('opponent_disconnected', () => {
      setDisconnected(true);
    });

    return () => {
      socket.off('game_created');
      socket.off('game_started');
      socket.off('game_state');
      socket.off('error');
      socket.off('opponent_disconnected');
    };
  }, []);

  function getPlayerId(state: FilteredGameState): PlayerId {
    const hasVisibleP1Hand = state.cards.some(c =>
      !('hidden' in c) && c.owner === 'player1' && c.zone === 'hand'
    );
    return hasVisibleP1Hand ? 'player1' : 'player2';
  }

  const returnToLobby = () => {
    setAppState({ screen: 'lobby' });
    setDisconnected(false);
  };

  return (
    <div className={styles.app}>
      <h1 className={styles.appTitle}>Worldbreakers</h1>

      {error && (
        <div className={styles.errorBanner}>{error}</div>
      )}

      {disconnected && (
        <div className={styles.errorBanner}>
          Opponent disconnected.{' '}
          <button onClick={returnToLobby} className={styles.disconnectBtn}>
            Return to Lobby
          </button>
        </div>
      )}

      {appState.screen === 'lobby' && <LobbyView />}

      {appState.screen === 'waiting' && (
        <div>
          <p>Game created: {appState.gameId}</p>
          <p>Waiting for opponent to join...</p>
        </div>
      )}

      {appState.screen === 'game' && (
        <CardDefinitionsProvider value={cardDefinitions}>
          <GameView
            playerId={appState.playerId}
            state={appState.state}
            legalActions={appState.legalActions}
            events={appState.events}
            onReturnToLobby={returnToLobby}
          />
        </CardDefinitionsProvider>
      )}
    </div>
  );
}
