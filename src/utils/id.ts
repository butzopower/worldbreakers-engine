let nextId = 1;

export function generateInstanceId(): string {
  return `card_${nextId++}`;
}

export function resetIdCounter(start = 1): void {
  nextId = start;
}

/**
 * Generate a unique ID for lasting effects.
 */
let nextEffectId = 1;

export function generateEffectId(): string {
  return `effect_${nextEffectId++}`;
}

export function resetEffectIdCounter(start = 1): void {
  nextEffectId = start;
}
