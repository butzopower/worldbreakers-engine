import type { VisibleCard } from '../types';
import { useCardDefinitions } from '../context/CardDefinitions';
import CardTooltip from './CardTooltip';

const FALLBACK_CARD = { id: '', name: 'Unknown', type: 'follower', guild: 'neutral', cost: 0 } as const;

const GUILD_COLORS: Record<string, string> = {
  earth: '#8B6914',
  moon: '#4a4a8a',
  void: '#6b2fa0',
  stars: '#c4a800',
  neutral: '#777777',
};

interface Props {
  card: VisibleCard;
  highlighted?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export default function FollowerCard({ card, highlighted, selected, dimmed, onClick, compact }: Props) {
  const cardDefinitions = useCardDefinitions();
  const cardDef = cardDefinitions[card.definitionId] ?? FALLBACK_CARD;
  const wounds = (card.counters['wound'] ?? 0);
  const stunned = (card.counters['stun'] ?? 0) > 0;
  const guildColor = GUILD_COLORS[cardDef.guild] ?? '#555';

  const effectiveHp = (cardDef.health ?? 0) - wounds;

  let border = `2px solid ${guildColor}`;
  if (selected) border = '2px solid #00ff88';
  if (highlighted) border = '2px solid #ffff00';

  return (
    <CardTooltip cardDef={cardDef} card={card}>
      <div
        onClick={onClick}
        style={{
          border,
          borderRadius: '6px',
          padding: compact ? '4px 6px 10px' : '6px 8px 10px',
          background: dimmed ? '#1a1a2e' : highlighted ? 'rgba(255,255,0,0.1)' : '#16213e',
          opacity: dimmed ? 0.5 : card.exhausted ? 0.7 : 1,
          cursor: onClick ? 'pointer' : 'default',
          minWidth: compact ? '90px' : '120px',
          fontSize: compact ? '10px' : '12px',
          position: 'relative',
          transform: card.exhausted ? 'rotate(5deg)' : undefined,
          transition: 'transform 0.2s',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '2px', color: guildColor }}>
          {cardDef.name}
          {compact && cardDef.cost > 0 && <span style={{ float: 'right', color: '#888' }}>{cardDef.cost}</span>}
        </div>

        {cardDef.type === 'follower' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: compact ? '10px' : '11px' }}>
            <span>STR {(cardDef.strength ?? 0) + (card.counters['strength_buff'] ?? 0)}</span>
            <span style={{ color: wounds > 0 ? '#e94560' : undefined }}>
              HP {effectiveHp}/{cardDef.health ?? 0}
            </span>
          </div>
        )}

        {cardDef.type === 'location' && (
          <div style={{ fontSize: compact ? '10px' : '11px' }}>
            Stage {card.counters['stage'] ?? 0}
          </div>
        )}

        {cardDef.type === 'worldbreaker' && cardDef.description && (
          <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>{cardDef.description}</div>
        )}

        {cardDef.keywords && cardDef.keywords.length > 0 && (
          <div style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>
            {cardDef.keywords.join(', ')}
          </div>
        )}

        {cardDef.description && cardDef.type === 'follower' && (
          <div style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>{cardDef.description}</div>
        )}

        {card.exhausted && (
          <div style={{ fontSize: '9px', color: '#e94560', position: 'absolute', top: '2px', right: '4px' }}>
            TAP
          </div>
        )}

        {stunned && (
          <div style={{ fontSize: '9px', color: '#ff8800', position: 'absolute', bottom: cardDef.standingRequirement ? '14px' : '2px', right: '4px' }}>
            STUN
          </div>
        )}

        {cardDef.standingRequirement && (
          <div style={{ position: 'absolute', bottom: '3px', right: '4px', display: 'flex', gap: '2px' }}>
            {Object.entries(cardDef.standingRequirement).flatMap(([guild, count]) =>
              Array.from({ length: count }, (_, i) => (
                <span
                  key={`${guild}-${i}`}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: GUILD_COLORS[guild] ?? '#555',
                    display: 'inline-block',
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>
    </CardTooltip>
  );
}
