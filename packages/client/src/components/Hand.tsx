import type { VisibleCard, InteractionMode, PlayerAction } from '../types';
import FollowerCard from './FollowerCard';
import styles from './Hand.module.css';

interface Props {
  cards: VisibleCard[];
  interactionMode: InteractionMode;
  legalActions: PlayerAction[];
  onCardClick: (card: VisibleCard) => void;
}

export default function Hand({ cards, interactionMode, legalActions, onCardClick }: Props) {
  if (cards.length === 0) {
    return <div className={styles.emptyHand}>Empty hand</div>;
  }

  return (
    <div>
      <div className={styles.handLabel}>Hand ({cards.length})</div>
      <div className={styles.cardList}>
        {cards.map(card => {
          const canPlay = legalActions.some(
            a => a.type === 'play_card' && a.cardInstanceId === card.instanceId
          );
          const isDiscardTarget = interactionMode.type === 'choose_discard' &&
            interactionMode.selected.includes(card.instanceId);
          const isTargetChoice = interactionMode.type === 'choose_target' &&
            interactionMode.validTargets.includes(card.instanceId);

          return (
            <FollowerCard
              key={card.instanceId}
              card={card}
              highlighted={(canPlay && interactionMode.type === 'none') || isTargetChoice}
              selected={isDiscardTarget}
              onClick={() => onCardClick(card)}
              compact
            />
          );
        })}
      </div>
    </div>
  );
}
