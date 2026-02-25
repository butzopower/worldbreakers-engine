import { useState, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ClientCardDefinition, LasingEffect, VisibleCard } from '../types';
import { GUILD_COLORS } from './FollowerCard';
import styles from './CardTooltip.module.css';

const GUILD_NAMES: Record<string, string> = {
  earth: 'Earth',
  moon: 'Moon',
  void: 'Void',
  stars: 'Stars',
  neutral: 'Neutral',
};

const TYPE_NAMES: Record<string, string> = {
  worldbreaker: 'Worldbreaker',
  follower: 'Follower',
  event: 'Event',
  location: 'Location',
};

const HOVER_DELAY = 400;
const TOOLTIP_WIDTH = 260;
const VIEWPORT_PADDING = 8;

interface Props {
  cardDef: ClientCardDefinition;
  card?: VisibleCard;
  lastingEffects?: LasingEffect[];
  children: ReactNode;
}

export default function CardTooltip({cardDef, card, lastingEffects, children}: Props) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({x: 0, y: 0});
  const [above, setAbove] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const halfWidth = TOOLTIP_WIDTH / 2;
    const centeredX = rect.left + rect.width / 2;
    const x = Math.max(halfWidth + VIEWPORT_PADDING, Math.min(centeredX, window.innerWidth - halfWidth - VIEWPORT_PADDING));
    const showAbove = rect.top > 300;
    const y = showAbove ? rect.top : rect.bottom;
    setPosition({x, y});
    setAbove(showAbove);
    setVisible(true);
  }, []);

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(showTooltip, HOVER_DELAY);
  }, [showTooltip]);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  const guildColor = GUILD_COLORS[cardDef.guild] ?? '#555';
  const wounds = card ? (card.counters['wound'] ?? 0) : 0;

  const baseStrength = cardDef?.strength ?? 0;
  const baseHealth = cardDef?.health ?? 0;

  const plusOnePlusOne = card ? (card.counters['plus_one_plus_one'] ?? 0) : 0;
  const buffedStrength = card ? (lastingEffects ?? [])
    .filter(({type}) => type === 'strength_buff')
    .filter(({targetInstanceIds}) => targetInstanceIds.includes(card.instanceId))
    .reduce((x, {amount}) => x + amount, 0) : 0;

  const portalPositionStyle = above
    ? { left: position.x, bottom: window.innerHeight - position.y + 8 }
    : { left: position.x, top: position.y + 8 };

  return (
    <div ref={wrapperRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className={styles.wrapper}>
      {children}
      {visible && createPortal(
        <div className={styles.portal} style={portalPositionStyle}>
          <div className={styles.tooltipBox} style={{ borderColor: guildColor }}>
            {/* Header: name + cost */}
            <div className={styles.header}>
              <span className={styles.cardName} style={{ color: guildColor }}>
                {cardDef.name}
              </span>
              {cardDef.cost > 0 && (
                <span className={styles.costBadge}>{cardDef.cost}</span>
              )}
            </div>

            {/* Type line */}
            <div className={styles.typeLine}>
              {GUILD_NAMES[cardDef.guild] ?? cardDef.guild} {TYPE_NAMES[cardDef.type] ?? cardDef.type}
            </div>

            {/* Stats for followers */}
            {cardDef.type === 'follower' && (
              <div className={`${styles.statsRow} ${styles.mb}`}>
                <div className={styles.statsGrid}>
                  <div className={styles.statLabelBold}>STR</div>
                  <div className={styles.statValue}>{baseStrength + plusOnePlusOne + buffedStrength}</div>
                  <div className={styles.statLabel}>Base</div>
                  <div className={styles.statValue}>{baseStrength}</div>
                  {plusOnePlusOne > 0 && (
                    <>
                      <div className={styles.statLabel}>+1/+1</div>
                      <div className={styles.statValue}>{plusOnePlusOne}</div>
                    </>
                  )}
                  {buffedStrength > 0 && (
                    <>
                      <div className={styles.statLabel}>Buff</div>
                      <div className={styles.statValue}>{buffedStrength}</div>
                    </>
                  )}
                </div>

                <div className={styles.statsGrid}>
                  <div className={styles.statLabel}>HP</div>
                  <div className={wounds > 0 ? styles.hpDamaged : styles.statValue}>
                    {baseHealth + plusOnePlusOne - wounds} / {baseHealth + plusOnePlusOne}
                  </div>
                  <div className={styles.statLabel}>Base</div>
                  <div className={styles.statValue}>{baseHealth} / {baseHealth}</div>
                  {plusOnePlusOne > 0 && (
                    <>
                      <div className={styles.statLabel}>+1/+1</div>
                      <div className={styles.statValue}>{plusOnePlusOne} / {plusOnePlusOne}</div>
                    </>
                  )}
                  {wounds > 0 && (
                    <>
                      <div className={styles.statLabel}>Wound</div>
                      <div className={styles.hpDamaged}>{wounds} / 0</div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Stages for locations */}
            {cardDef.type === 'location' && cardDef.locationStages && cardDef.locationStages.length > 0 && (
              <div className={`${styles.locationStages} ${styles.mb}`}>
                {cardDef.locationStages.map(ls => {
                  const stageCountersRemaining = card ? (card.counters['stage'] ?? 0) : 0;
                  const spentStages = (cardDef.locationStages?.length ?? 0) - stageCountersRemaining;
                  const available = (card?.zone !== 'board') || ls.stage > spentStages;
                  return (
                    <div
                      key={ls.stage}
                      className={`${styles.locationStage} ${available ? styles['locationStage--available'] : styles['locationStage--spent']}`}
                    >
                      <span className={available ? styles['stageBullet--available'] : styles['stageBullet--spent']}>
                        {available ? '●' : '○'}
                      </span>
                      {ls.description ?? `Stage ${ls.stage}`}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Keywords */}
            {cardDef.keywords && cardDef.keywords.length > 0 && (
              <div className={`${styles.keywordList} ${styles.mb}`}>
                {cardDef.keywords.map(kw => (
                  <span key={kw} className={styles.keyword}>{kw}</span>
                ))}
              </div>
            )}

            {/* Ability description */}
            {cardDef.description && (
              <div className={`${styles.description} ${cardDef.cardDescription ? styles.mb : ''}`}>
                {cardDef.description}
              </div>
            )}

            {/* Standing requirement */}
            {cardDef.standingRequirement && (
              <div className={`${styles.standingRow} ${cardDef.cardDescription ? styles.mb : ''}`}>
                <span>Requires</span>
                {Object.entries(cardDef.standingRequirement).map(([guild, count]) => (
                  <span key={guild} className={styles.standingGroup}>
                    {Array.from({length: count}, (_, i) => (
                      <span
                        key={i}
                        className={styles.standingDot}
                        style={{ background: GUILD_COLORS[guild] ?? '#555' }}
                      />
                    ))}
                    <span style={{ color: GUILD_COLORS[guild] ?? '#555' }}>
                      {GUILD_NAMES[guild] ?? guild}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Card description / flavor text */}
            {cardDef.cardDescription && (
              <div className={styles.flavorText}>
                {cardDef.cardDescription}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
