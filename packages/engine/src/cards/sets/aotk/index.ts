import { registerCard } from '../../registry';
import { events } from './events';

export function registerSetCards(): void {
  for (const card of [...events]) {
    registerCard(card);
  }
}
