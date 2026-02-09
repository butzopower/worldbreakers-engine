/**
 * Simple seeded PRNG using mulberry32 algorithm.
 * Returns [randomValue, nextState] for pure functional usage.
 */
export function nextRandom(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, (state + 1) | 0];
}

/**
 * Shuffle an array using the seeded RNG. Returns [shuffledArray, nextRngState].
 */
export function seededShuffle<T>(array: readonly T[], rngState: number): [T[], number] {
  const result = [...array];
  let state = rngState;
  for (let i = result.length - 1; i > 0; i--) {
    const [rand, nextState] = nextRandom(state);
    state = nextState;
    const j = Math.floor(rand * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return [result, state];
}
