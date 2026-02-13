import type { VisibleCard } from '../types';
import { useCardDefinitions } from '../context/CardDefinitions';
import CardTooltip from './CardTooltip';

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

  return (
    <CardTooltip cardDef={cardDef} card={card}>
      <div
        onClick={onClick}
        style={{
          border: highlighted ? '2px solid #ffff00' : '2px solid #555',
          borderRadius: '6px',
          padding: '6px 8px',
          background: highlighted ? 'rgba(255,255,0,0.1)' : '#16213e',
          minWidth: '120px',
          fontSize: '12px',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '2px', color: '#8B6914' }}>
          {cardDef.name}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Stage: {'●'.repeat(stage)}{'○'.repeat(Math.max(0, (cardDef.stages ?? 0) - stage))}</span>
          {canDevelop && (
            <button
              onClick={(e) => { e.stopPropagation(); onDevelop?.(); }}
              style={{
                background: '#0f3460', color: 'white', border: 'none',
                padding: '2px 6px', cursor: 'pointer', borderRadius: '3px',
                fontSize: '10px',
              }}
            >
              Develop
            </button>
          )}
        </div>
        {cardDef.keywords?.includes('hidden') && (
          <div style={{ fontSize: '9px', color: '#aaa' }}>hidden</div>
        )}
      </div>
    </CardTooltip>
  );
}
