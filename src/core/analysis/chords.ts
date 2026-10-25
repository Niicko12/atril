import type { Note } from '../types';
import type { PolyNote } from './types';

export interface ChordEvent {
  u: number;
  name: string;
}
const TEMPLATES: [string, number[]][] = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['7', [0, 4, 7, 10]],
  ['m7', [0, 3, 7, 10]],
  ['dim', [0, 3, 6]],
];
const SHARP = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const FLAT = ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
function histogram(events: readonly PolyNote[], a: number, b: number) {
  const h = new Array<number>(12).fill(0);
  let low: number | null = null,
    lowWeight = 0;
  for (const n of events) {
    const overlap = Math.min(b, n.t1) - Math.max(a, n.t0);
    if (overlap <= 0) continue;
    const weight = overlap * (n.amplitude ?? 0.5),
      pc = n.m % 12;
    h[pc] = (h[pc] ?? 0) + weight;
    if (n.m <= 55 && weight > lowWeight) {
      low = pc;
      lowWeight = weight;
    }
  }
  return { h, low };
}
function bestChord(h: number[], low: number | null, names: string[]): string | null {
  const total = h.reduce((a, b) => a + b, 0);
  if (total < 0.05) return null;
  let best = -Infinity,
    name = '';
  for (let root = 0; root < 12; root++)
    for (const [suffix, intervals] of TEMPLATES) {
      let score = h.reduce((sum, v, pc) => sum + (intervals.includes((pc - root + 12) % 12) ? v : -0.6 * v), 0);
      if (intervals.length > 3) score -= 0.1 * total;
      if (low === root) score += 0.15 * total;
      if (score > best) {
        best = score;
        name = names[root] + suffix;
      }
    }
  return name;
}
/** Ventanas de ocho semicorcheas; evita repeticiones consecutivas (ear-spec 13.1). */
export function chordsFor(events: readonly PolyNote[], bpm: number, origin: number, key: number): ChordEvent[] {
  if (!events.length || bpm <= 0 || !Number.isFinite(bpm)) return [];
  const unit = 60 / bpm / 4,
    end = Math.max(...events.map((n) => n.t1)),
    out: ChordEvent[] = [];
  let previous: string | null = null;
  for (let u = 0; origin + u * unit < end; u += 8) {
    const a = origin + u * unit,
      { h, low } = histogram(events, a, a + 8 * unit);
    const name = bestChord(h, low, key < 0 ? FLAT : SHARP);
    if (name && name !== previous) out.push({ u, name });
    previous = name;
  }
  return out;
}
/** Copia las notas; cada cifrado se asocia al inicio más cercano, hasta cuatro semicorcheas. */
export function attachChords(notes: readonly Note[], chords: readonly ChordEvent[]): Note[] {
  const out = notes.map((n) => ({ ...n }));
  let start = 0;
  const starts = out.map((n) => {
    const s = start;
    start += n.d;
    return s;
  });
  for (const chord of chords) {
    let best = -1,
      distance = Infinity;
    starts.forEach((s, i) => {
      const d = Math.abs(s - chord.u);
      if (d < distance && !out[i]?.c) {
        best = i;
        distance = d;
      }
    });
    const target = out[best];
    if (target && distance <= 4) target.c = chord.name;
  }
  return out;
}
