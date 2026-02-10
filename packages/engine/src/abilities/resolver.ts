import { PlayerId } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { AbilityDefinition, EffectPrimitive } from '../types/effects';
import { resolvePrimitive, findValidTargets, ResolveContext } from './primitives';
import { getCustomResolver } from './system';

/**
 * Resolve an ability - either data-driven primitives or custom resolve function.
 * If the ability requires target selection, sets up a pending choice.
 */
export function resolveAbility(
  state: GameState,
  controller: PlayerId,
  sourceCardId: string,
  ability: AbilityDefinition,
  abilityIndex: number,
  triggeringCardId?: string,
): { state: GameState; events: GameEvent[] } {
  const ctx: ResolveContext = {
    controller,
    sourceCardId,
    triggeringCardId,
  };

  // Custom resolve takes precedence
  if (ability.customResolve) {
    const customFn = getCustomResolver(ability.customResolve);
    if (customFn) {
      return customFn(state, ctx);
    }
    // If no custom resolver found, fall through to effects
  }

  if (!ability.effects || ability.effects.length === 0) {
    return { state, events: [] };
  }

  // Check if any effect needs target selection
  for (const effect of ability.effects) {
    if (needsTargetChoice(effect)) {
      const targetSelector = getTargetSelector(effect);
      if (targetSelector && targetSelector.kind === 'choose') {
        const validTargets = findValidTargets(state, targetSelector, ctx);
        if (validTargets.length === 0) {
          // No valid targets - skip this ability
          return { state, events: [] };
        }
        if (validTargets.length === 1) {
          // Auto-select single target
          ctx.chosenTargets = [validTargets[0]];
        } else {
          // Need player choice - set pending
          return {
            state: {
              ...state,
              pendingChoice: {
                type: 'choose_target',
                playerId: controller,
                sourceCardId,
                abilityIndex,
                effects: ability.effects,
                triggeringCardId,
              },
            },
            events: [],
          };
        }
      }
    }
  }

  return resolveEffects(state, ability.effects, ctx);
}

/**
 * Resolve a list of effects with a given context (targets already chosen).
 */
export function resolveEffects(
  state: GameState,
  effects: EffectPrimitive[],
  ctx: ResolveContext,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  for (const effect of effects) {
    const result = resolvePrimitive(s, effect, ctx);
    s = result.state;
    events.push(...result.events);
  }

  return { state: s, events };
}

function needsTargetChoice(effect: EffectPrimitive): boolean {
  if ('target' in effect && effect.target) {
    return effect.target.kind === 'choose';
  }
  return false;
}

function getTargetSelector(effect: EffectPrimitive) {
  if ('target' in effect) {
    return effect.target;
  }
  return null;
}
