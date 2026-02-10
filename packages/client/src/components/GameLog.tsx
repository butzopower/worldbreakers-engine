import { useRef, useEffect } from 'react';
import type { GameEvent } from '../types';

interface Props {
  events: GameEvent[];
}

function formatEvent(event: GameEvent): string {
  switch (event.type) {
    case 'game_started': return 'Game started!';
    case 'phase_changed': return `Phase: ${event.phase}`;
    case 'turn_advanced': return `Turn → ${event.activePlayer}`;
    case 'mythium_gained': return `${event.player} +${event.amount} mythium`;
    case 'mythium_spent': return `${event.player} -${event.amount} mythium`;
    case 'power_gained': return `${event.player} +${event.amount} power`;
    case 'standing_gained': return `${event.player} +${event.amount} ${event.guild} standing`;
    case 'card_drawn': return `${event.player} drew a card`;
    case 'card_played': return `${event.player} played ${event.definitionId ?? 'card'}`;
    case 'card_moved': return `Card → ${event.toZone}`;
    case 'card_exhausted': return `Card tapped`;
    case 'card_readied': return `Card readied`;
    case 'card_discarded': return `${event.player} discarded`;
    case 'counter_added': return `+${event.amount} ${event.counterType} counter`;
    case 'counter_removed': return `-${event.amount} ${event.counterType} counter`;
    case 'combat_started': return `${event.attackingPlayer} attacks!`;
    case 'blockers_declared': return 'Blockers declared';
    case 'fight_resolved': return 'Fight resolved';
    case 'breach_damage': return 'Breach damage dealt';
    case 'combat_ended': return 'Combat ended';
    case 'ability_triggered': return `Ability triggered: ${event.timing}`;
    case 'location_developed': return 'Location developed';
    case 'rally_phase': return 'Rally phase';
    case 'round_ended': return `Round ended`;
    case 'game_over': return `Game over! Winner: ${event.winner}`;
    default: return event.type;
  }
}

export default function GameLog({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  // Show last 50 events
  const recent = events.slice(-50);

  return (
    <div style={{
      background: '#16213e', borderRadius: '6px', padding: '8px',
      maxHeight: '500px', overflowY: 'auto', fontSize: '11px',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#888' }}>Game Log</div>
      {recent.map((event, i) => (
        <div key={i} style={{ color: '#aaa', marginBottom: '2px', borderBottom: '1px solid #1a1a2e', paddingBottom: '2px' }}>
          {formatEvent(event)}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
