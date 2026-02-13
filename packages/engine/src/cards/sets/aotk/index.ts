import { registerCard } from '../../registry';
import { events } from './events';
import { followers } from './followers';
import { locations } from './locations';

export function registerSetCards(): void {
  for (const card of [...events, ...followers, ...locations]) {
    registerCard(card);
  }
}
