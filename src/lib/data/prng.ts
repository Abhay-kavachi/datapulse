// ============================================================================
// DataPulse — Deterministic Seeded PRNG
// Mulberry32 implementation: same seed → identical sequence across runs.
// ============================================================================

/**
 * Mulberry32 — a fast, deterministic 32-bit PRNG.
 * Returns a function that produces numbers in [0, 1) on each call.
 */
export function createPRNG(seed: number): () => number {
  let state = seed | 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a gaussian-distributed random number using Box-Muller transform.
 * Mean=0, StdDev=1 by default.
 */
export function gaussianRandom(rng: () => number, mean = 0, stdDev = 1): number {
  const u1 = rng();
  const u2 = rng();
  // Avoid log(0)
  const safeU1 = Math.max(u1, 1e-10);
  const z = Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}
