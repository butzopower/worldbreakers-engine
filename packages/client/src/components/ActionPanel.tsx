import type { FilteredGameState, PlayerId, PlayerAction, InteractionMode } from '../types.js';

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

  // In interaction mode, show cancel button
  if (interactionMode.type !== 'none') {
    return null; // InteractionOverlay handles this
  }

  if (!isMyTurn) {
    if (hasPending) {
      return <div style={{ marginTop: '8px', color: '#ffff00', fontSize: '12px' }}>Waiting for your choice...</div>;
    }
    return <div style={{ marginTop: '8px', color: '#888', fontSize: '12px' }}>Opponent's turn</div>;
  }

  const hasAction = (type: string) => legalActions.some(a => a.type === type);
  const canAttack = legalActions.some(a => a.type === 'attack');

  const btnStyle = (enabled: boolean) => ({
    background: enabled ? '#0f3460' : '#333',
    color: enabled ? 'white' : '#666',
    border: 'none',
    padding: '6px 12px',
    cursor: enabled ? 'pointer' : 'default',
    borderRadius: '4px',
    fontSize: '12px',
  });

  return (
    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <button
        onClick={() => onAction({ type: 'gain_mythium' })}
        disabled={!hasAction('gain_mythium')}
        style={btnStyle(hasAction('gain_mythium'))}
      >
        +1 Mythium
      </button>

      <button
        onClick={() => onAction({ type: 'draw_card' })}
        disabled={!hasAction('draw_card')}
        style={btnStyle(hasAction('draw_card'))}
      >
        Draw Card
      </button>

      {['earth', 'moon', 'void', 'stars'].map(guild => {
        const canBuy = legalActions.some(a => a.type === 'buy_standing' && a.guild === guild);
        return canBuy ? (
          <button
            key={guild}
            onClick={() => onAction({ type: 'buy_standing', guild })}
            style={btnStyle(true)}
          >
            Buy {guild} Standing
          </button>
        ) : null;
      })}

      {canAttack && (
        <button
          onClick={onStartAttack}
          style={{ ...btnStyle(true), background: '#e94560' }}
        >
          Attack
        </button>
      )}
    </div>
  );
}
