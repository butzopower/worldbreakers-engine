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

  // Resolve effects sequentially, stopping at the first that needs a choice
  let s = state;
  const events: GameEvent[] = [];

  for (let i = 0; i < ability.effects.length; i++) {
    const effect = ability.effects[i];

    if (needsModeChoice(effect)) {
      return {
        state: {
          ...s,
          pendingChoice: {
            type: 'choose_mode',
            playerId: controller,
            sourceCardId,
            modes: effect.modes,
          },
        },
        events,
      };
    }

    if (needsTargetChoice(effect)) {
      const targetSelector = getTargetSelector(effect)!;
      if (targetSelector.kind === 'choose') {
        const validTargets = findValidTargets(s, targetSelector, ctx);
        if (validTargets.length === 0) {
          // Skip this effect but continue with remaining effects
          continue;
        }

        const remainingEffects = ability.effects.slice(i + 1);
        return {
          state: {
            ...s,
            pendingChoice: {
              type: 'choose_target',
              playerId: controller,
              sourceCardId,
              abilityIndex,
              effects: [effect],
              filter: targetSelector.filter,
              triggeringCardId,
              remainingEffects: remainingEffects.length > 0 ? remainingEffects : undefined,
            },
          },
          events,
        };
      }
    }

    const result = resolvePrimitive(s, effect, ctx);
    s = result.state;
    events.push(...result.events);
    if (s.pendingChoice) {
      return { state: s, events };
    }
  }

  return { state: s, events };
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

function needsModeChoice(effect: EffectPrimitive): effect is { type: 'choose_one'; modes: { label: string; effects: EffectPrimitive[] }[] } {
  return effect.type === 'choose_one';
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
