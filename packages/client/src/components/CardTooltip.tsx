import { useState, useRef, useCallback, type ReactNode } from 'react';
import type { ClientCardDefinition, VisibleCard } from '../types.js';

const GUILD_COLORS: Record<string, string> = {
  earth: '#8B6914',
  moon: '#4a4a8a',
  void: '#6b2fa0',
  stars: '#c4a800',
  neutral: '#777777',
};

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
  children: ReactNode;
}

export default function CardTooltip({ cardDef, card, children }: Props) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
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
    setPosition({ x, y });
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
  const strengthBuff = card ? (card.counters['strength_buff'] ?? 0) : 0;

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'inline-block' }}
    >
      {children}
      {visible && (
        <div
          style={{
            position: 'fixed',
            left: position.x,
            [above ? 'bottom' : 'top']: above
              ? window.innerHeight - position.y + 8
              : position.y + 8,
            transform: 'translateX(-50%)',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            background: '#1a1a2e',
            border: `1px solid ${guildColor}`,
            borderRadius: '8px',
            padding: '10px 12px',
            minWidth: '200px',
            maxWidth: '260px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
          }}>
            {/* Header: name + cost */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: guildColor }}>
                {cardDef.name}
              </span>
              {cardDef.cost > 0 && (
                <span style={{
                  background: '#0f3460',
                  color: '#7ec8e3',
                  borderRadius: '4px',
                  padding: '1px 6px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}>
                  {cardDef.cost}
                </span>
              )}
            </div>

            {/* Type line */}
            <div style={{
              fontSize: '11px',
              color: '#888',
              borderBottom: '1px solid #333',
              paddingBottom: '4px',
              marginBottom: '6px',
            }}>
              {GUILD_NAMES[cardDef.guild] ?? cardDef.guild} {TYPE_NAMES[cardDef.type] ?? cardDef.type}
            </div>

            {/* Stats for followers */}
            {cardDef.type === 'follower' && (
              <div style={{
                display: 'flex',
                gap: '12px',
                fontSize: '12px',
                marginBottom: '6px',
              }}>
                <span>
                  <span style={{ color: '#888' }}>STR </span>
                  <span style={{ color: '#e0e0e0', fontWeight: 'bold' }}>
                    {(cardDef.strength ?? 0) + strengthBuff}
                  </span>
                </span>
                <span>
                  <span style={{ color: '#888' }}>HP </span>
                  <span style={{
                    color: wounds > 0 ? '#e94560' : '#e0e0e0',
                    fontWeight: 'bold',
                  }}>
                    {(cardDef.health ?? 0) - wounds}/{cardDef.health ?? 0}
                  </span>
                </span>
              </div>
            )}

            {/* Stages for locations */}
            {cardDef.type === 'location' && cardDef.locationStages && cardDef.locationStages.length > 0 && (
              <div style={{ marginBottom: '6px' }}>
                {cardDef.locationStages.map(ls => {
                  const stageCountersRemaining = card ? (card.counters['stage'] ?? 0) : 0;
                  const spentStages = (cardDef.locationStages?.length ?? 0) - stageCountersRemaining;
                  const available = (card?.zone !== 'board') || ls.stage > spentStages;
                  return (
                    <div key={ls.stage} style={{
                      fontSize: '11px',
                      lineHeight: '1.4',
                      color: available ? '#d0d0d0' : '#555',
                      textDecoration: available ? 'none' : 'line-through',
                      marginBottom: '2px',
                    }}>
                      <span style={{ color: available ? '#888' : '#555', marginRight: '4px' }}>
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
              <div style={{
                display: 'flex',
                gap: '4px',
                flexWrap: 'wrap',
                marginBottom: '6px',
              }}>
                {cardDef.keywords.map(kw => (
                  <span key={kw} style={{
                    background: '#2a2a4e',
                    color: '#b0b0d0',
                    borderRadius: '3px',
                    padding: '1px 6px',
                    fontSize: '10px',
                    fontStyle: 'italic',
                  }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* Ability description */}
            {cardDef.description && (
              <div style={{
                fontSize: '12px',
                color: '#d0d0d0',
                lineHeight: '1.4',
                marginBottom: cardDef.cardDescription ? '6px' : 0,
              }}>
                {cardDef.description}
              </div>
            )}

            {/* Standing requirement */}
            {cardDef.standingRequirement && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                color: '#888',
                marginBottom: cardDef.cardDescription ? '6px' : 0,
              }}>
                <span>Requires</span>
                {Object.entries(cardDef.standingRequirement).map(([guild, count]) => (
                  <span key={guild} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {Array.from({ length: count }, (_, i) => (
                      <span
                        key={i}
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: GUILD_COLORS[guild] ?? '#555',
                          display: 'inline-block',
                        }}
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
              <div style={{
                fontSize: '11px',
                color: '#999',
                fontStyle: 'italic',
                borderTop: '1px solid #333',
                paddingTop: '6px',
                lineHeight: '1.4',
              }}>
                {cardDef.cardDescription}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
