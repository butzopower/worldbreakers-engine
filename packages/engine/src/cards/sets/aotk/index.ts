import { registerCard } from '../../registry';
import { eventResolvers, events } from './events';
import { followerResolvers, followers } from './followers';
import { locations } from './locations';
import { worldbreakers } from './worldbreakers';
import { registerCustomResolver } from "../../../abilities/system";

export function registerSetCards(): void {
  for (const card of [...events, ...followers, ...locations, ...worldbreakers]) {
    registerCard(card);
  }

  for (const {key, resolver} of [...eventResolvers, ...followerResolvers]) {
    registerCustomResolver(key, resolver);
  }
}
