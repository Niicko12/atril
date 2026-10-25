import { FakeAudioContext, type FakeParam } from './fake-audio.test-helper';
import { getContext, getMaster, resetContextForTests } from './engine/context';
import { silentWav } from './engine/silent-wav';
import { ksBuffer, ksCacheSize } from './engine/synth-plucked';
import { pianoDecay, pianoPartials } from './engine/synth-piano';
import { PRESETS } from './engine/presets';
import { tone } from './engine/tone';
import { LOOKAHEAD_SEC, buildEvents, eventAt, scheduleWindow } from './engine/scheduler';
import { liveCount, stopVoices } from './engine/voices';

beforeEach(() => {
  vi.stubGlobal('AudioContext', FakeAudioContext);
  resetContextForTests();
  stopVoices();
});

const ctx = () => getContext() as unknown as FakeAudioContext;

describe('contexto y desbloqueo (T-CTX, T-UNL)', () => {
  it('un solo contexto con master 0,55 y compresor −14/4', () => {
    expect(getContext()).toBe(getContext());
    expect((getMaster() as unknown as { gain: FakeParam }).gain.value).toBe(0.55);
    const comp = ctx().nodes.find((n) => n.kind === 'comp') as unknown as { threshold: FakeParam; ratio: FakeParam };
    expect([comp.threshold.value, comp.ratio.value]).toEqual([-14, 4]);
  });
  it('WAV silencioso: cabecera RIFF/WAVE de 844 bytes', () => {
    const bytes = atob(silentWav().split(',')[1] as string);
    expect([bytes.slice(0, 4), bytes.slice(8, 12), bytes.length]).toEqual(['RIFF', 'WAVE', 844]);
  });
});

describe('Karplus-Strong (T-KS)', () => {
  const c = {
    sampleRate: 44100,
    createBuffer: (_: number, l: number, sr: number) => new FakeAudioContext().createBuffer(1, l, sr),
  } as unknown as BaseAudioContext;
  it('pico normalizado a 0,8 y duración sustain + 0,2', () => {
    const buf = ksBuffer(c, { midi: 69, sustain: 2.2, bright: 0.6 });
    const d = buf.getChannelData(0);
    expect(Math.max(...d.map(Math.abs))).toBeCloseTo(0.8, 5);
    expect(buf.length).toBe(Math.floor(44100 * 2.4));
  });
  it('decae: la energía del final es mucho menor que la del inicio', () => {
    const d = ksBuffer(c, { midi: 57, sustain: 1, bright: 0.6 }).getChannelData(0);
    const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
    expect(rms(d.subarray(d.length - 2000)) / rms(d.subarray(0, 2000))).toBeLessThan(0.01);
  });
  it('caché LRU de 128 entradas', () => {
    for (let m = 0; m < 140; m++) ksBuffer(c, { midi: 40 + (m % 70), sustain: 0.1, bright: m });
    expect(ksCacheSize()).toBe(128);
  });
});

describe('piano (T-PNO)', () => {
  it('Do4: 6 parciales inarmónicos y T1 = 3,2 s', () => {
    const f = 261.6;
    const p = pianoPartials(f);
    expect(p).toHaveLength(6);
    expect(p[1]?.f).toBeCloseTo(f * 2 * Math.sqrt(1 + 0.0003 * 4), 6);
    expect(pianoDecay(f)).toBeCloseTo(3.2, 5);
  });
  it('Do8 omite parciales > 12 kHz; La0 dura 6 s', () => {
    expect(pianoPartials(4186).length).toBeLessThan(3);
    expect(pianoDecay(27.5)).toBe(6);
  });
  it('tone de piano crea 6 osciladores + martillo y los registra', () => {
    tone(60, 0, 0.5, 'piano');
    expect(ctx().sources('osc')).toHaveLength(6);
    expect(ctx().sources('buffer')).toHaveLength(1);
    expect(liveCount()).toBe(7);
  });
});

describe('timbres sostenidos (T-SUS)', () => {
  it.each(Object.entries(PRESETS))('%s usa su perfil armónico', (timbre, p) => {
    tone(69, 0, 1, timbre as 'bow');
    expect(
      ctx()
        .sources('osc')
        .slice(0, 2)
        .map((o) => o.type),
    ).toEqual(p!.harmonics ? ['custom', 'custom'] : [...p!.types]);
  });
  it('flauta agrega ruido de aliento; metal barre el filtro', () => {
    tone(72, 0, 1, 'flute');
    expect(
      ctx()
        .sources('buffer')
        .some((b) => b.loop),
    ).toBe(true);
    tone(60, 0, 1, 'brass');
    const sweeps = ctx()
      .nodes.filter((n) => n.kind === 'biquad')
      .map((b) => (b as unknown as { frequency: FakeParam }).frequency.calls);
    expect(sweeps.some((c) => c.some(([k]) => k === 'exp'))).toBe(true);
  });
  it('valores inválidos no suenan (P3/P4)', () => {
    tone(200, 0, 1, 'reed');
    tone(60, 0, 0, 'reed');
    expect(ctx().sources()).toHaveLength(0);
  });
});

describe('programador (T-SCH, T-POS)', () => {
  const notes = Array.from({ length: 3000 }, (_, i) => ({ p: i % 4 ? 60 : null, d: 2 }));
  it('a ♩=120 una corchea dura 0,25 s; empieza en fromIndex', () => {
    const ev = buildEvents(notes, 5, 120);
    expect(ev[0]).toMatchObject({ i: 5, s: 0, e: 0.25 });
  });
  it('solo programa lo que cae en los próximos 200 ms y salta silencios (T-SCH-01/04)', () => {
    const ev = buildEvents(notes, 0, 120);
    const played: number[] = [];
    const next = scheduleWindow({ events: ev, next: 0, startAt: 0.15, now: 0 }, (e) => played.push(e.i));
    expect(next).toBe(1);
    expect(played).toEqual([]);
    expect(0.15 + (ev[next]?.s ?? 0)).toBeGreaterThanOrEqual(LOOKAHEAD_SEC);
  });
  it('cada nota se programa una vez, en orden y a su tiempo (T-SCH-02)', () => {
    const ev = buildEvents(notes.slice(0, 20), 0, 120);
    const played: [number, number][] = [];
    let next = 0;
    for (let now = 0; now < 6; now += 0.025)
      next = scheduleWindow({ events: ev, next, startAt: 0.15, now }, (e, when) => played.push([e.i, when]));
    expect(played.map(([i]) => i)).toEqual(ev.filter((e) => e.p != null).map((e) => e.i));
    expect(played[0]?.[1]).toBeCloseTo(0.15 + 0.25, 6);
  });
  it('búsqueda binaria de la nota que suena (T-POS-01)', () => {
    const ev = buildEvents(
      [
        { p: 60, d: 4 },
        { p: null, d: 4 },
        { p: 62, d: 8 },
      ],
      0,
      60,
    );
    expect([eventAt(ev, -0.1), eventAt(ev, 0), eventAt(ev, 1.5), eventAt(ev, 2.9), eventAt(ev, 5)]).toEqual([
      -1, 0, 1, 2, -1,
    ]);
  });
  it('stopVoices detiene todo y vacía el registro (T-STP-01)', () => {
    tone(60, 0, 1, 'guitar');
    tone(64, 0, 1, 'voice');
    stopVoices();
    expect(
      ctx()
        .sources()
        .every((s) => s.stopCalls > 0),
    ).toBe(true);
    expect(liveCount()).toBe(0);
  });
});

describe('articulación y espectro revisados', () => {
  it('violín usa una tabla armónica rica y estable, con menos de un cent de desafinación', () => {
    tone(69, 2, 1, 'bow');
    const oscillators = ctx().sources('osc').slice(0, 2);
    expect(oscillators.map((o) => o.type)).toEqual(['custom', 'custom']);
    expect(oscillators.map((o) => o.frequency.value)).toEqual([440, 440]);
    expect(oscillators.every((o) => Math.abs(o.detune.value) < 1)).toBe(true);
    const wave = oscillators[0]?.periodicWave as { imag: number[] };
    expect(wave.imag[0]).toBe(0);
    expect(wave.imag.slice(2).filter((amplitude) => amplitude > 0.1).length).toBeGreaterThan(4);
    tone(72, 3, 1, 'bow');
    expect(
      ctx()
        .sources('osc')
        .filter((o) => o.type === 'custom')[2]?.periodicWave,
    ).toBe(oscillators[0]?.periodicWave);
  });
  it('cada familia usa un espectro propio y no reutiliza una onda genérica', () => {
    for (const timbre of ['bow', 'reed', 'brass', 'voice'] as const) tone(69, 0, 1, timbre);
    const waves = ctx()
      .sources('osc')
      .filter((o) => o.type === 'custom')
      .map((o) => o.periodicWave);
    expect(new Set(waves).size).toBe(4);
  });
  it('vibrato permanece apagado hasta su retardo y modula cents, no la frecuencia base', () => {
    tone(69, 2, 1, 'bow');
    const oscillators = ctx().sources('osc');
    const lfo = oscillators[2];
    const gain = lfo?.connected[0] as { gain: FakeParam; connected: unknown[] };
    expect(gain.gain.calls.slice(0, 2)).toEqual([
      ['set', 0, 2],
      ['set', 0, 2.25],
    ]);
    expect(gain.connected).toEqual(oscillators.slice(0, 2).map((o) => o.detune));
    expect(gain.gain.calls[2]?.[1]).toBeLessThan(8);
  });
  it('una nota corta no tiene vibrato y su ataque termina antes de la liberación', () => {
    tone(69, 2, 0.02, 'bow');
    expect(ctx().sources('osc')).toHaveLength(2);
    const envelopes = ctx()
      .nodes.filter((node) => node.kind === 'gain')
      .map((node) => (node as unknown as { gain: FakeParam }).gain.calls);
    const envelope = envelopes.find((calls) =>
      calls.some(([kind, value]) => kind === 'exp' && value === PRESETS.bow?.peak),
    );
    expect(envelope).toBeDefined();
    expect(envelope?.map((call) => call[2])).toEqual([2, 2.007, 2.02, 2.045]);
    stopVoices();
    expect(
      ctx()
        .sources()
        .every((source) => source.stopCalls > 0),
    ).toBe(true);
  });
});
