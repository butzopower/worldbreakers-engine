import { VisibleCard, ClientCardDefinition, LasingEffect } from '../types';
import { useCardDefinitions } from '../context/CardDefinitions';
import CardTooltip from './CardTooltip';
import styles from './FollowerCard.module.css';

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
    <div className={styles.badgeList}>
      {badges.map(badge => (
        <span
          key={badge.label}
          className={`${styles.badge} ${compact ? styles['badge--compact'] : styles['badge--normal']}`}
          style={{ color: badge.color, background: badge.bg }}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

export const GUILD_COLORS: Record<string, string> = {
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

  let borderColor = guildColor;
  if (selected) borderColor = '#00ff88';
  if (highlighted) borderColor = '#ffff00';

  const cardClasses = [
    styles.card,
    compact ? styles['card--compact'] : '',
    onClick ? styles['card--clickable'] : '',
    dimmed ? styles['card--dimmed'] : '',
    highlighted && !dimmed ? styles['card--highlighted'] : '',
    card.exhausted && !dimmed ? styles['card--exhausted'] : '',
  ].filter(Boolean).join(' ');

  return (
    <CardTooltip cardDef={cardDef} card={card} lastingEffects={lastingEffects}>
      <div
        onClick={onClick}
        className={cardClasses}
        style={{ border: `2px solid ${borderColor}` }}
      >
        <div className={styles.cardName} style={{ color: guildColor }}>
          {cardDef.name}
          {compact && cardDef.cost > 0 && <span className={styles.cardCost}>{cardDef.cost}</span>}
        </div>

        {cardDef.type === 'follower' && (
          <div className={`${styles.statsRow} ${compact ? styles['statsRow--compact'] : styles['statsRow--normal']}`}>
            <span>
              <span>STR {(cardDef.strength ?? 0) + (card.counters['strength_buff'] ?? 0) + plusOnePlusOne}</span>
              {buffedStrength > 0 && <span>&nbsp;(<span style={{ color: '#0A0' }}>+{buffedStrength}</span>)</span>}
            </span>
            <span className={wounds > 0 ? styles.hpDamaged : undefined}>
              HP {effectiveHp}/{maxHp}
            </span>
          </div>
        )}

        {cardDef.type === 'location' && (
          <div className={compact ? styles['stageLabel--compact'] : styles.stageLabel}>
            Stage {card.counters['stage'] ?? 0}
          </div>
        )}

        {cardDef.type === 'worldbreaker' && cardDef.description && (
          <div className={styles.worldbreakerDesc}>{cardDef.description}</div>
        )}

        {cardDef.type === 'follower' && (
          <StatusBadges card={card} cardDef={cardDef} compact={compact} />
        )}

        {cardDef.description && cardDef.type === 'follower' && (
          <div className={styles.description}>{cardDef.description}</div>
        )}

        {cardDef.standingRequirement && (
          <div className={styles.standingDots}>
            {Object.entries(cardDef.standingRequirement).flatMap(([guild, count]) =>
              Array.from({ length: count }, (_, i) => (
                <span
                  key={`${guild}-${i}`}
                  className={styles.standingDot}
                  style={{ background: GUILD_COLORS[guild] ?? '#555' }}
                />
              ))
            )}
          </div>
        )}
      </div>
    </CardTooltip>
  );
}
