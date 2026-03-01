import { GameState } from '../types/state';
import { ResolveContext } from './primitives';
import { EngineStep } from "../types/steps";

export type CustomResolverFn = (
  state: GameState,
  ctx: ResolveContext,
) => EngineStep[];

const customResolvers = new Map<string, CustomResolverFn>();

export function registerCustomResolver(key: string, fn: CustomResolverFn): void {
  customResolvers.set(key, fn);
}

export function getCustomResolver(key: string): CustomResolverFn | undefined {
  return customResolvers.get(key);
}