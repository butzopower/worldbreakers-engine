import { registerCard } from '../../registry';
import { events } from './events';
import { followers } from './followers';

export function registerSetCards(): void {
  for (const card of [...events, ...followers]) {
    registerCard(card);
  }
}
