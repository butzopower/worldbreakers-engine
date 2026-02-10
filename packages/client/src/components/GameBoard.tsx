import type { PlayerId, FilteredGameState, VisibleCard, InteractionMode, PlayerAction } from '../types';
import { isVisible } from '../types';
import PlayerArea from './PlayerArea';
import OpponentArea from './OpponentArea';

interface Props {
  state: FilteredGameState;
  playerId: PlayerId;
  opponent: PlayerId;
  interactionMode: InteractionMode;
  onCardClick: (card: VisibleCard) => void;
  legalActions: PlayerAction[];
}

export default function GameBoard({ state, playerId, opponent, interactionMode, onCardClick, legalActions }: Props) {
  return (
    <div>
      <OpponentArea
        state={state}
        opponent={opponent}
        interactionMode={interactionMode}
        onCardClick={onCardClick}
      />

      <div style={{
        borderTop: '2px solid #e94560', borderBottom: '2px solid #e94560',
        padding: '4px 0', margin: '8px 0', textAlign: 'center',
        fontSize: '11px', color: '#888',
      }}>
        {state.combat ? `Combat - ${state.combat.step}` : 'Battlefield'}
      </div>

      <PlayerArea
        state={state}
        playerId={playerId}
        interactionMode={interactionMode}
        onCardClick={onCardClick}
        legalActions={legalActions}
      />
    </div>
  );
}
