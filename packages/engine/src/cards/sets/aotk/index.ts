import { registerCard } from '../../registry.js';
import { events } from './events.js';

export function registerSetCards(): void {
  for (const card of [...events]) {
    registerCard(card);
  }
}
