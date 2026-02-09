import type { FilteredGameState, PlayerId } from '../types.js';

interface Props {
  state: FilteredGameState;
  playerId: PlayerId;
  isMyTurn: boolean;
}

export default function GameStatus({ state, playerId, isMyTurn }: Props) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '12px', padding: '8px 12px', background: '#16213e',
      borderRadius: '6px', fontSize: '12px',
    }}>
      <div>
        Round {state.round} | Actions: {state.actionsTaken}/8 | Phase: {state.phase}
      </div>
      <div style={{ color: isMyTurn ? '#00ff88' : '#888' }}>
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
