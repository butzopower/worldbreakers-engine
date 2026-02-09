import type { VisibleCard, InteractionMode } from '../types.js';

// Card definitions - minimal info for rendering
const CARD_DATA: Record<string, { name: string; str: number; hp: number; keywords?: string[]; guild: string; cost: number; type: string; stages?: number; description?: string }> = {
  stone_sentinel: { name: 'Stone Sentinel', str: 0, hp: 0, guild: 'earth', cost: 0, type: 'worldbreaker', description: 'Your Attack: Attackers get +1 str' },
  void_oracle: { name: 'Void Oracle', str: 0, hp: 0, guild: 'void', cost: 0, type: 'worldbreaker', description: 'Your Attack: Draw 1 card' },
  militia_scout: { name: 'Militia Scout', str: 1, hp: 1, guild: 'earth', cost: 1, type: 'follower' },
  shield_bearer: { name: 'Shield Bearer', str: 1, hp: 3, keywords: ['stationary'], guild: 'earth', cost: 2, type: 'follower' },
  night_raider: { name: 'Night Raider', str: 2, hp: 1, keywords: ['bloodshed'], guild: 'moon', cost: 2, type: 'follower' },
  void_channeler: { name: 'Void Channeler', str: 1, hp: 2, guild: 'void', cost: 3, type: 'follower', description: 'Action: Gain 1 power' },
  star_warden: { name: 'Star Warden', str: 2, hp: 2, keywords: ['overwhelm'], guild: 'stars', cost: 3, type: 'follower' },
  earthshaker_giant: { name: 'Earthshaker Giant', str: 3, hp: 4, guild: 'earth', cost: 5, type: 'follower', description: 'Enters: 1 wound to follower' },
  sudden_strike: { name: 'Sudden Strike', str: 0, hp: 0, guild: 'earth', cost: 1, type: 'event', description: '2 wounds to follower' },
  void_rift: { name: 'Void Rift', str: 0, hp: 0, guild: 'void', cost: 3, type: 'event', description: 'Each discard 1, gain 1 power' },
  watchtower: { name: 'Watchtower', str: 0, hp: 0, guild: 'earth', cost: 2, type: 'location', stages: 3 },
  void_nexus: { name: 'Void Nexus', str: 0, hp: 0, keywords: ['hidden'], guild: 'void', cost: 3, type: 'location', stages: 2 },
};

export function getCardData(definitionId: string) {
  return CARD_DATA[definitionId] ?? { name: definitionId, str: 0, hp: 0, guild: 'earth', cost: 0, type: 'follower' };
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
}

export default function FollowerCard({ card, highlighted, selected, dimmed, onClick, compact }: Props) {
  const data = getCardData(card.definitionId);
  const wounds = (card.counters['wound'] ?? 0);
  const stunned = (card.counters['stun'] ?? 0) > 0;
  const guildColor = GUILD_COLORS[data.guild] ?? '#555';

  const effectiveHp = data.hp - wounds;

  let border = `2px solid ${guildColor}`;
  if (selected) border = '2px solid #00ff88';
  if (highlighted) border = '2px solid #ffff00';

  return (
    <div
      onClick={onClick}
      style={{
        border,
        borderRadius: '6px',
        padding: compact ? '4px 6px' : '6px 8px',
        background: dimmed ? '#1a1a2e' : '#16213e',
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
        {data.name}
        {compact && data.cost > 0 && <span style={{ float: 'right', color: '#888' }}>{data.cost}</span>}
      </div>

      {data.type === 'follower' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: compact ? '10px' : '11px' }}>
          <span>STR {data.str + (card.counters['strength_buff'] ?? 0)}</span>
          <span style={{ color: wounds > 0 ? '#e94560' : undefined }}>
            HP {effectiveHp}/{data.hp}
          </span>
        </div>
      )}

      {data.type === 'location' && (
        <div style={{ fontSize: compact ? '10px' : '11px' }}>
          Stage {card.counters['stage'] ?? 0}
        </div>
      )}

      {data.type === 'worldbreaker' && data.description && (
        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>{data.description}</div>
      )}

      {data.keywords && data.keywords.length > 0 && (
        <div style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>
          {data.keywords.join(', ')}
        </div>
      )}

      {data.description && data.type === 'follower' && (
        <div style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>{data.description}</div>
      )}

      {card.exhausted && (
        <div style={{ fontSize: '9px', color: '#e94560', position: 'absolute', top: '2px', right: '4px' }}>
          TAP
        </div>
      )}

      {stunned && (
        <div style={{ fontSize: '9px', color: '#ff8800', position: 'absolute', bottom: '2px', right: '4px' }}>
          STUN
        </div>
      )}
    </div>
  );
}
