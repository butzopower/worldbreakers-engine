import type { PlayerId, FilteredGameState, VisibleCard, InteractionMode, PlayerAction } from '../types';
import PlayerArea from './PlayerArea';
import OpponentArea from './OpponentArea';
import styles from './GameBoard.module.css';

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

      <div className={styles.battlefield}>
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
