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
        const newState: GameState = {
          ...s,
          pendingChoice: {
            type: 'choose_target',
            playerId: controller,
            sourceCardId,
            abilityIndex,
            effects: [effect],
            filter: targetSelector.filter,
            triggeringCardId,
          },
        };
        if (remainingEffects.length > 0) {
          newState.remainingEffects = { effects: remainingEffects, controller, sourceCardId, triggeringCardId };
        }
        return { state: newState, events };
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
 * Resolve a list of effects with a given context. If a 'choose' target is
 * encountered and no targets have been chosen yet, pauses and creates a
 * pendingChoice, storing any remaining effects for later.
 */
export function resolveEffects(
  state: GameState,
  effects: EffectPrimitive[],
  ctx: ResolveContext,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];

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
            abilityIndex: 0,
            effects: [effect],
            filter: targetSelector.filter,
          },
        };
        if (remainingEffects.length > 0) {
          s = { ...s, remainingEffects: { effects: remainingEffects, controller: ctx.controller, sourceCardId: ctx.sourceCardId } };
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
