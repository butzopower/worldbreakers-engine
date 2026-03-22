import { useRef, useEffect, ReactElement } from 'react';
import type { ClientCardDefinition, GameEvent } from '../types';
import { useCardDefinitions } from "../context/CardDefinitions";
import styles from './GameLog.module.css';
import CardTooltip from "./CardTooltip";

interface Props {
  events: GameEvent[];
}

interface RevealProps {
  player: string,
  defIds: string[],
  cardDefinitions: Record<string, ClientCardDefinition>
}

function Reveal({cardDefinitions, defIds, player}: RevealProps) {
  return <span>
    {player} reveals {' '}
    <span className={styles.revealList}>
      {
        defIds.map(
          (id, i) => {
            return <span className={styles.revealItem} key={i}>
              <Preview defId={id} cardDefinitions={cardDefinitions} />
            </span>;
          }
        )
      }
      </span>
    </span>;
}

interface PreviewProps {
  defId: string,
  cardDefinitions: Record<string, ClientCardDefinition>
}

function Preview({defId, cardDefinitions}: PreviewProps) {
  const cardDef = cardDefinitions[defId];
  return <span className={styles.preview}><CardTooltip cardDef={cardDef}>{cardDef.name}</CardTooltip></span>;
}

function formatEvent(event: GameEvent, cardDefinitions: Record<string, ClientCardDefinition>): string | ReactElement {
  switch (event.type) {
    case 'game_started': return 'Game started!';
    case 'phase_changed': return `Phase: ${event.phase}`;
    case 'turn_advanced': return `Turn → ${event.activePlayer}`;
    case 'mythium_gained': return `${event.player} +${event.amount} mythium`;
    case 'mythium_spent': return `${event.player} -${event.amount} mythium`;
    case 'power_gained': return `${event.player} +${event.amount} power`;
    case 'standing_gained': return `${event.player} +${event.amount} ${event.guild} standing`;
    case 'card_drawn': return `${event.player} drew a card`;
    case 'card_played': return <span>{event.player as string} played {<Preview defId={event.definitionId as string} cardDefinitions={cardDefinitions}/>}</span>;
    case 'card_moved': return `Card moved ${event.from} → ${event.to}`;
    case 'card_exhausted': return `Card tapped`;
    case 'card_readied': return `Card readied`;
    case 'card_discarded': return `${event.player} discarded`;
    case 'counter_added': return `+${event.amount} ${event.counter} counter`;
    case 'counter_removed': return `-${event.amount} ${event.counter} counter`;
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
    case 'reveal': return <Reveal player={event.player as string} defIds={event.cardDefinitionIds as string[]} cardDefinitions={cardDefinitions}/>;
    case 'deck_shuffled': return `${event.player} shuffled their deck`;
    case 'resource_adjusted': {
      const label = (event.resource as string).replace('standing_', '') ;
      const dir = (event.delta as number) > 0 ? '+' : '';
      return `${event.player} adjusted ${label} ${dir}${event.delta} (fix up)`;
    }
    default: return event.type;
  }
}

export default function GameLog({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const cardDefinitions = useCardDefinitions();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  const recent = events.slice(-50);

  return (
    <div className={styles.log}>
      <div className={styles.logTitle}>Game Log</div>
      {recent.map((event, i) => (
        <div key={i} className={styles.logEntry}>
          {formatEvent(event, cardDefinitions)}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
