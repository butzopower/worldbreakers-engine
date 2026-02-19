import { registerCard } from '../../registry';
import { events } from './events';
import { followers } from './followers';
import { locations } from './locations';
import { worldbreakers } from './worldbreakers';

export function registerSetCards(): void {
  for (const card of [...events, ...followers, ...locations, ...worldbreakers]) {
    registerCard(card);
  }
}
