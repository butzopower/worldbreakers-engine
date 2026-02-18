import { PlayerId } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { AbilityDefinition, EffectPrimitive } from '../types/effects';
import { resolvePrimitive, findValidTargets, ResolveContext } from './primitives';
import { getCustomResolver } from './system';

/**
 * Resolve an ability - either data-driven primitives or custom resolve function.
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

  if (ability.customResolve) {
    const customFn = getCustomResolver(ability.customResolve);
    if (customFn) {
      return customFn(state, ctx);
    }
  }

  if (!ability.effects || ability.effects.length === 0) {
    return { state, events: [] };
  }

  return resolveEffects(state, ability.effects, ctx, abilityIndex);
}

/**
 * Resolve a list of effects with a given context. Handles choose_one (mode
 * choices) and choose target selectors by pausing and creating a pendingChoice,
 * storing any remaining effects for later.
 *
 * When ctx.chosenTargets is set, the caller has already resolved a target
 * choice and we just execute the effect directly.
 */
export function resolveEffects(
  state: GameState,
  effects: EffectPrimitive[],
  ctx: ResolveContext,
  abilityIndex = 0,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];

    if (needsModeChoice(effect)) {
      return {
        state: {
          ...s,
          pendingChoice: {
            type: 'choose_mode',
            playerId: ctx.controller,
            sourceCardId: ctx.sourceCardId,
            modes: effect.modes,
          },
        },
        events,
      };
    }

    if (!ctx.chosenTargets && needsTargetChoice(effect)) {
      const targetSelector = getTargetSelector(effect)!;
      if (targetSelector.kind === 'choose') {
        const validTargets = findValidTargets(s, targetSelector, ctx);
        if (validTargets.length === 0) continue;

        const remainingEffects = effects.slice(i + 1);
        s = {
          ...s,
          pendingChoice: {
            type: 'choose_target',
            playerId: ctx.controller,
            sourceCardId: ctx.sourceCardId,
            abilityIndex,
            effects: [effect],
            filter: targetSelector.filter,
            triggeringCardId: ctx.triggeringCardId,
          },
        };
        if (remainingEffects.length > 0) {
          s = { ...s, remainingEffects: { effects: remainingEffects, controller: ctx.controller, sourceCardId: ctx.sourceCardId, triggeringCardId: ctx.triggeringCardId } };
        }
        return { state: s, events };
      }
    }

    const result = resolvePrimitive(s, effect, ctx);
    s = result.state;
    events.push(...result.events);
    if (s.pendingChoice) return { state: s, events };
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
