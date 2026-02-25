import type { FilteredGameState, PlayerId } from '../types';
import styles from './GameStatus.module.css';

interface Props {
  state: FilteredGameState;
  playerId: PlayerId;
  isMyTurn: boolean;
}

const TOTAL_ACTIONS = 8;

function ownerOfTurn(turnIndex: number, firstPlayer: PlayerId): PlayerId {
  const firstPlayerActsHere = turnIndex % 2 === 0;
  return firstPlayerActsHere
    ? firstPlayer
    : firstPlayer === 'player1' ? 'player2' : 'player1';
}

type CoinState = 'completed' | 'active' | 'future';

function getCoinState(turnIndex: number, actionsTaken: number, phase: string): CoinState {
  if (phase === 'rally' || phase === 'gameOver') return 'completed';
  if (turnIndex < actionsTaken) return 'completed';
  if (turnIndex === actionsTaken) return 'active';
  return 'future';
}

export default function GameStatus({ state, playerId, isMyTurn }: Props) {
  const statusText = state.phase === 'gameOver'
    ? (state.winner === 'draw' ? 'Draw!' : state.winner === playerId ? 'Victory!' : 'Defeat!')
    : state.pendingChoice
      ? state.pendingChoice.playerId === playerId ? 'Your choice' : 'Opponent choosing...'
      : isMyTurn ? 'Your turn' : "Opponent's turn";

  const statusTextExtraStyle = state.phase === 'gameOver' ? '' : isMyTurn ? styles['my--turn'] : '';

  return (
    <div className={styles.statusBar}>
      <span className={styles.roundLabel}>Round {state.round}</span>

      <div className={styles.coinRow}>
        {Array.from({ length: TOTAL_ACTIONS }, (_, i) => {
          const owner = ownerOfTurn(i, state.firstPlayer);
          const coinState = getCoinState(i, state.actionsTaken, state.phase);
          const isNearPlayer = owner === playerId;
          return (
            <div
              key={i}
              className={[
                styles.coin,
                styles[`coin--${owner}`],
                styles[`coin--${coinState}`],
                isNearPlayer ? styles['coin--near'] : styles['coin--far'],
              ].join(' ')}
            >
              {i + 1}
            </div>
          );
        })}
      </div>

      <span className={`${styles.statusLabel} ${statusTextExtraStyle}`}>{statusText}</span>
    </div>
  );
}
