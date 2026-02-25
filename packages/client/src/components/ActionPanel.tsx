import type { FilteredGameState, PlayerId, PlayerAction, InteractionMode } from '../types';
import styles from './ActionPanel.module.css';

interface Props {
  state: FilteredGameState;
  playerId: PlayerId;
  legalActions: PlayerAction[];
  interactionMode: InteractionMode;
  onAction: (action: PlayerAction) => void;
  onStartAttack: () => void;
  onCancelInteraction: () => void;
}

export default function ActionPanel({
  state, playerId, legalActions, interactionMode, onAction, onStartAttack, onCancelInteraction,
}: Props) {
  const isMyTurn = state.activePlayer === playerId && !state.pendingChoice && !state.combat;
  const hasPending = state.pendingChoice?.playerId === playerId;

  if (interactionMode.type !== 'none') {
    return null; // InteractionOverlay handles this
  }

  if (!isMyTurn) {
    if (hasPending) {
      return <div className={`${styles.statusMessage} ${styles.statusWaiting}`}>Waiting for your choice...</div>;
    }
    return <div className={`${styles.statusMessage} ${styles.statusOpponent}`}>Opponent's turn</div>;
  }

  const hasAction = (type: string) => legalActions.some(a => a.type === type);
  const canAttack = legalActions.some(a => a.type === 'attack');

  const btnClass = (enabled: boolean) => `${styles.btn} ${enabled ? styles.btnEnabled : styles.btnDisabled}`;

  return (
    <div className={styles.actionPanel}>
      <button
        onClick={() => onAction({ type: 'gain_mythium' })}
        disabled={!hasAction('gain_mythium')}
        className={btnClass(hasAction('gain_mythium'))}
      >
        +1 Mythium
      </button>

      <button
        onClick={() => onAction({ type: 'draw_card' })}
        disabled={!hasAction('draw_card')}
        className={btnClass(hasAction('draw_card'))}
      >
        Draw Card
      </button>

      {['earth', 'moon', 'void', 'stars'].map(guild => {
        const canBuy = legalActions.some(a => a.type === 'buy_standing' && a.guild === guild);
        return canBuy ? (
          <button
            key={guild}
            onClick={() => onAction({ type: 'buy_standing', guild })}
            className={`${styles.btn} ${styles.btnEnabled}`}
          >
            Buy {guild} Standing
          </button>
        ) : null;
      })}

      {canAttack && (
        <button onClick={onStartAttack} className={`${styles.btn} ${styles.btnAttack}`}>
          Attack
        </button>
      )}
    </div>
  );
}
