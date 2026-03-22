import { socket } from '../socket';
import { useFixupMode } from '../context/FixupMode';
import type { PlayerId } from '../types';
import styles from './ResourceAdjuster.module.css';

type AdjustableResource = 'mythium' | 'power' | 'standing_earth' | 'standing_moon' | 'standing_void' | 'standing_stars';

interface Props {
  player: PlayerId;
  resource: AdjustableResource;
  label: string;
  value: number;
  className?: string;
}

export default function ResourceAdjuster({ player, resource, label, value, className }: Props) {
  const { fixupMode } = useFixupMode();

  const adjust = (delta: number) => {
    socket.emit('adjust_resource', { player, resource, delta });
  };

  if (!fixupMode) {
    return <span className={className}>{label}{label ? ': ' : ''}{value}</span>;
  }

  return (
    <span className={`${styles.adjuster} ${className ?? ''}`}>
      <button className={styles.btn} onClick={() => adjust(-1)}>-</button>
      {label}{label ? ': ' : ''}{value}
      <button className={styles.btn} onClick={() => adjust(1)}>+</button>
    </span>
  );
}
