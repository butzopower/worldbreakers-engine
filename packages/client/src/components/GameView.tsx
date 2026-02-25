import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { useInteractionMode } from '../hooks/useInteractionMode';
import GameBoard from './GameBoard';
import ActionPanel from './ActionPanel';
import InteractionOverlay from './InteractionOverlay';
import GameStatus from './GameStatus';
import GameLog from './GameLog';
import type { PlayerId, FilteredGameState, PlayerAction, GameEvent, VisibleCard } from '../types';
import { isVisible } from '../types';
import styles from './GameView.module.css';

interface Props {
  playerId: PlayerId;
  state: FilteredGameState;
  legalActions: PlayerAction[];
  events: GameEvent[];
  onReturnToLobby: () => void;
}

export default function GameView({ playerId, state, legalActions, events, onReturnToLobby }: Props) {
  const interaction = useInteractionMode();
  const [log, setLog] = useState<GameEvent[]>([]);

  useEffect(() => {
    if (events.length > 0) {
      setLog(prev => [...prev, ...events]);
    }
  }, [state.version]);

  useEffect(() => {
    if (!state.pendingChoice || state.pendingChoice.playerId !== playerId) {
      if (interaction.mode.type !== 'none' && interaction.mode.type !== 'select_attackers') {
        interaction.reset();
      }
      return;
    }

    const choice = state.pendingChoice;
    switch (choice.type) {
      case 'choose_blockers': {
        interaction.startBlockerSelection(choice.attackerIds);
        break;
      }
      case 'choose_attackers': {
        interaction.startAttackSelection();
        break;
      }
      case 'choose_target': {
        const targets = legalActions
          .filter((a): a is PlayerAction & { targetInstanceId: string } =>
            a.type === 'choose_target' && typeof a.targetInstanceId === 'string')
          .map(a => a.targetInstanceId);
        interaction.startTargetSelection(targets);
        break;
      }
      case 'choose_discard': {
        interaction.startDiscardSelection(choice.count);
        break;
      }
      case 'choose_breach_target': {
        interaction.startBreachSelection(choice.validLocationIds);
        break;
      }
      case 'choose_mode': {
        interaction.startModeSelection(choice.modes);
        break;
      }
    }
  }, [state.pendingChoice?.type, state.version]);

  const submitAction = (action: PlayerAction) => {
    socket.emit('submit_action', { action });
    interaction.reset();
  };

  const handleCardClick = (card: VisibleCard) => {
    const { mode } = interaction;

    switch (mode.type) {
      case 'select_attackers': {
        if (card.owner === playerId && card.zone === 'board') {
          interaction.toggleAttacker(card.instanceId);
        }
        break;
      }
      case 'select_blocker': {
        if (card.owner === playerId && card.zone === 'board') {
          interaction.selectBlocker(card.instanceId);
          if (mode.attackerIds.length === 1) {
            submitAction({ type: 'declare_blocker', blockerId: card.instanceId, attackerId: mode.attackerIds[0] });
          }
        } else if (mode.selectedBlockerId && mode.attackerIds.includes(card.instanceId)) {
          submitAction({ type: 'declare_blocker', blockerId: mode.selectedBlockerId, attackerId: card.instanceId });
        }
        break;
      }
      case 'choose_target': {
        if (mode.validTargets.includes(card.instanceId)) {
          submitAction({ type: 'choose_target', targetInstanceId: card.instanceId });
        }
        break;
      }
      case 'choose_discard': {
        if (card.owner === playerId && card.zone === 'hand') {
          interaction.toggleDiscard(card.instanceId);
        }
        break;
      }
      case 'choose_breach_target': {
        if (mode.validLocations.includes(card.instanceId)) {
          submitAction({ type: 'damage_location', locationInstanceId: card.instanceId });
        }
        break;
      }
      case 'none': {
        if (card.owner === playerId && card.zone === 'hand') {
          const canPlay = legalActions.some(
            a => a.type === 'play_card' && a.cardInstanceId === card.instanceId
          );
          if (canPlay) {
            submitAction({ type: 'play_card', cardInstanceId: card.instanceId });
          }
        }
        break;
      }
    }
  };

  const opponent: PlayerId = playerId === 'player1' ? 'player2' : 'player1';
  const isMyTurn = state.activePlayer === playerId;
  const gameOver = state.phase === 'gameOver';

  return (
    <div className={styles.gameView}>
      <div className={styles.main}>
        <GameStatus state={state} playerId={playerId} isMyTurn={isMyTurn} />

        {gameOver && (
          <div className={styles.gameOverBanner}>
            <h2 className={styles.gameOverTitle}>
              {state.winner === 'draw' ? 'Draw!' :
                state.winner === playerId ? 'Victory!' : 'Defeat!'}
            </h2>
            <button onClick={onReturnToLobby} className={styles.returnBtn}>
              Return to Lobby
            </button>
          </div>
        )}

        <GameBoard
          state={state}
          playerId={playerId}
          opponent={opponent}
          interactionMode={interaction.mode}
          onCardClick={handleCardClick}
          legalActions={legalActions}
        />

        {!gameOver && (
          <>
            <ActionPanel
              state={state}
              playerId={playerId}
              legalActions={legalActions}
              interactionMode={interaction.mode}
              onAction={submitAction}
              onStartAttack={interaction.startAttackSelection}
              onCancelInteraction={interaction.reset}
            />
            <InteractionOverlay
              mode={interaction.mode}
              state={state}
              playerId={playerId}
              onSubmitAction={submitAction}
              onCancel={interaction.reset}
            />
          </>
        )}
      </div>

      <div className={styles.sidebar}>
        <GameLog events={log} />
      </div>
    </div>
  );
}
