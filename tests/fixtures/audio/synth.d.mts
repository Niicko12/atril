export const SR: number;
export function rng(seed: number): () => number;
export function melody(notes: [number | null, number][], opts?: { gap?: number; cents?: number; vibrato?: number; amp?: number; tail?: number }): Float32Array;
export function mix(seed?: number): Float32Array;
export const CASES: Record<'escala' | 'himnoDesafinado' | 'mezcla', { make(): Float32Array; expected: number[] }>;
