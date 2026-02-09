import type { VisibleCard, InteractionMode, PlayerAction } from '../types.js';
import FollowerCard from './FollowerCard.js';

interface Props {
  cards: VisibleCard[];
  interactionMode: InteractionMode;
  legalActions: PlayerAction[];
  onCardClick: (card: VisibleCard) => void;
}

export default function Hand({ cards, interactionMode, legalActions, onCardClick }: Props) {
  if (cards.length === 0) {
    return <div style={{ color: '#555', fontSize: '12px', fontStyle: 'italic' }}>Empty hand</div>;
  }

  return (
    <div>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
        Hand ({cards.length})
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {cards.map(card => {
          const canPlay = legalActions.some(
            a => a.type === 'play_card' && a.cardInstanceId === card.instanceId
          );
          const isDiscardTarget = interactionMode.type === 'choose_discard' &&
            interactionMode.selected.includes(card.instanceId);

          return (
            <FollowerCard
              key={card.instanceId}
              card={card}
              highlighted={canPlay && interactionMode.type === 'none'}
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
