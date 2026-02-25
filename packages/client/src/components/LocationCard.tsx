import type { VisibleCard } from '../types';
import { useCardDefinitions } from '../context/CardDefinitions';
import CardTooltip from './CardTooltip';
import styles from './LocationCard.module.css';

interface Props {
  card: VisibleCard;
  canDevelop: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  onDevelop?: () => void;
}

export default function LocationCard({ card, canDevelop, highlighted, onClick, onDevelop }: Props) {
  const cardDefinitions = useCardDefinitions();
  const cardDef = cardDefinitions[card.definitionId] ?? { id: '', name: card.definitionId, type: 'location', guild: 'neutral', cost: 0, stages: 0 };
  const stage = card.counters['stage'] ?? 0;

  const cardClasses = [
    styles.card,
    onClick ? styles['card--clickable'] : '',
    highlighted ? styles['card--highlighted'] : '',
  ].filter(Boolean).join(' ');

  return (
    <CardTooltip cardDef={cardDef} card={card}>
      <div onClick={onClick} className={cardClasses}>
        <div className={styles.cardName}>{cardDef.name}</div>
        <div className={styles.stageRow}>
          <span>Stage: {'●'.repeat(stage)}{'○'.repeat(Math.max(0, (cardDef.stages ?? 0) - stage))}</span>
          {canDevelop && (
            <button
              onClick={(e) => { e.stopPropagation(); onDevelop?.(); }}
              className={styles.developBtn}
            >
              Develop
            </button>
          )}
        </div>
        {cardDef.keywords?.includes('hidden') && (
          <div className={styles.hiddenKeyword}>hidden</div>
        )}
      </div>
    </CardTooltip>
  );
}
