import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { ResolveContext } from './primitives';
import { gainPower } from '../state/mutate';
import { getHand } from '../state/query';
import { opponentOf } from '../types/core';

export type CustomResolverFn = (
  state: GameState,
  ctx: ResolveContext,
) => { state: GameState; events: GameEvent[] };

const customResolvers = new Map<string, CustomResolverFn>();

export function registerCustomResolver(key: string, fn: CustomResolverFn): void {
  customResolvers.set(key, fn);
}

export function getCustomResolver(key: string): CustomResolverFn | undefined {
  return customResolvers.get(key);
}