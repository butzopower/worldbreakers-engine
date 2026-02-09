import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket.js';
import { useInteractionMode } from '../hooks/useInteractionMode.js';
import GameBoard from './GameBoard.js';
import ActionPanel from './ActionPanel.js';
import InteractionOverlay from './InteractionOverlay.js';
import GameStatus from './GameStatus.js';
import GameLog from './GameLog.js';
import type { PlayerId, FilteredGameState, PlayerAction, GameEvent, VisibleCard } from '../types.js';
import { isVisible } from '../types.js';

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

  // Auto-enter interaction modes based on pending choices
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
        const attackerIds = (choice.context.attackerIds as string[]) ?? [];
        interaction.startBlockerSelection(attackerIds);
        break;
      }
      case 'choose_target': {
        // Find valid targets from legal actions
        const targets = legalActions
          .filter(a => a.type === 'choose_target')
          .map(a => a.targetInstanceId as string);
        interaction.startTargetSelection(targets);
        break;
      }
      case 'choose_discard': {
        const count = (choice.context.count as number) ?? 1;
        interaction.startDiscardSelection(count);
        break;
      }
      case 'choose_breach_target': {
        const validLocs = (choice.context.validLocationIds as string[]) ?? [];
        interaction.startBreachSelection(validLocs);
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
      case 'select_blockers': {
        if (card.owner === playerId && card.zone === 'board') {
          // Clicking own follower: if already assigned, remove; else pick attacker
          if (mode.assignments[card.instanceId]) {
            interaction.removeBlockerAssignment(card.instanceId);
          } else if (mode.attackerIds.length === 1) {
            interaction.assignBlocker(card.instanceId, mode.attackerIds[0]);
          }
          // For multiple attackers, InteractionOverlay handles attacker selection
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
        // Click card in hand to play it
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
    <div style={{ display: 'flex', gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <GameStatus
          state={state}
          playerId={playerId}
          isMyTurn={isMyTurn}
        />

        {gameOver && (
          <div style={{
            background: '#0f3460', padding: '16px', borderRadius: '8px',
            marginBottom: '12px', textAlign: 'center',
          }}>
            <h2 style={{ margin: '0 0 8px' }}>
              {state.winner === 'draw' ? 'Draw!' :
                state.winner === playerId ? 'Victory!' : 'Defeat!'}
            </h2>
            <button
              onClick={onReturnToLobby}
              style={{
                background: '#e94560', color: 'white', border: 'none',
                padding: '8px 16px', cursor: 'pointer', borderRadius: '4px',
              }}
            >
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
              onAssignBlocker={interaction.assignBlocker}
              onCancel={interaction.reset}
            />
          </>
        )}
      </div>

      <div style={{ width: '250px' }}>
        <GameLog events={log} />
      </div>
    </div>
  );
}
