import { VisibleCard, ClientCardDefinition, LasingEffect } from '../types';
import { useCardDefinitions } from '../context/CardDefinitions';
import CardTooltip from './CardTooltip';

const FALLBACK_CARD = { id: '', name: 'Unknown', type: 'follower', guild: 'neutral', cost: 0 } as const;

interface Badge {
  label: string;
  color: string;
  bg: string;
}

function getActiveBadges(card: VisibleCard, cardDef: ClientCardDefinition): Badge[] {
  const badges: Badge[] = [];

  if ((card.counters['plus_one_plus_one'] ?? 0) > 0) {
    const count = card.counters['plus_one_plus_one'];
    badges.push({ label: count > 1 ? `+1/+1 x${count}` : '+1/+1', color: '#4ade80', bg: '#14532d' });
  }

  if ((card.counters['stun'] ?? 0) > 0) {
    badges.push({ label: 'STUN', color: '#ff8800', bg: '#4a2800' });
  }

  if (card.exhausted) {
    badges.push({ label: 'TAP', color: '#e94560', bg: '#4a1020' });
  }

  if (cardDef.keywords?.includes('stationary')) {
    badges.push({ label: 'STATIONARY', color: '#999', bg: '#2a2a2a' });
  }

  return badges;
}

function StatusBadges({ card, cardDef, compact }: { card: VisibleCard; cardDef: ClientCardDefinition; compact?: boolean }) {
  const badges = getActiveBadges(card, cardDef);
  if (badges.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '3px' }}>
      {badges.map(badge => (
        <span
          key={badge.label}
          style={{
            fontSize: compact ? '8px' : '9px',
            color: badge.color,
            background: badge.bg,
            borderRadius: '3px',
            padding: '0px 4px',
            lineHeight: '1.5',
            fontWeight: 'bold',
          }}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

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
  lastingEffects?: LasingEffect[];
}

export default function FollowerCard({ card, highlighted, selected, dimmed, onClick, compact, lastingEffects }: Props) {
  const cardDefinitions = useCardDefinitions();
  const cardDef = cardDefinitions[card.definitionId] ?? FALLBACK_CARD;
  const wounds = (card.counters['wound'] ?? 0);
  const plusOnePlusOne = (card.counters['plus_one_plus_one'] ?? 0);
  const guildColor = GUILD_COLORS[cardDef.guild] ?? '#555';

  const maxHp = (cardDef.health ?? 0) + plusOnePlusOne;
  const effectiveHp = maxHp - wounds;

  const buffedStrength = (lastingEffects ?? [])
    .filter(({type}) => type === 'strength_buff')
    .filter(({targetInstanceIds}) => targetInstanceIds.includes(card.instanceId))
    .reduce((x, { amount }) => { return x + amount }, 0);

  let border = `2px solid ${guildColor}`;
  if (selected) border = '2px solid #00ff88';
  if (highlighted) border = '2px solid #ffff00';

  return (
    <CardTooltip cardDef={cardDef} card={card} lastingEffects={lastingEffects}>
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
            <span>
              <span>STR {(cardDef.strength ?? 0) + (card.counters['strength_buff'] ?? 0) + plusOnePlusOne}</span>
              { buffedStrength > 0 && <span>&nbsp;(<span style={{color: '#0A0'}}>+{buffedStrength}</span>)</span> }
            </span>
            <span style={{ color: wounds > 0 ? '#e94560' : undefined }}>
              HP {effectiveHp}/{maxHp}
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

        {cardDef.type === 'follower' && (
          <StatusBadges card={card} cardDef={cardDef} compact={compact} />
        )}

        {cardDef.description && cardDef.type === 'follower' && (
          <div style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>{cardDef.description}</div>
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
