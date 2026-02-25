import type { FilteredGameState, PlayerId } from '../types';
import styles from './GameStatus.module.css';

interface Props {
  state: FilteredGameState;
  playerId: PlayerId;
  isMyTurn: boolean;
}

export default function GameStatus({ state, playerId, isMyTurn }: Props) {
  return (
    <div className={styles.statusBar}>
      <div>
        Round {state.round} | Actions: {state.actionsTaken}/8 | Phase: {state.phase}
      </div>
      <div className={`${styles.turnIndicator} ${isMyTurn ? styles['turnIndicator--myTurn'] : ''}`}>
        {state.phase === 'gameOver'
          ? 'Game Over'
          : state.pendingChoice
            ? state.pendingChoice.playerId === playerId
              ? 'Your choice'
              : 'Opponent choosing...'
            : isMyTurn
              ? 'Your turn'
              : "Opponent's turn"}
      </div>
    </div>
  );
}
