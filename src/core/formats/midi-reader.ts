/** Lectura de bytes SMF a eventos crudos (formats-spec 13.1). */
export interface RawMidiNote {
  track: number;
  channel: number;
  pitch: number;
  start: number;
  end: number;
}

export interface MidiFile {
  division: number;
  notes: RawMidiNote[];
  tempos: number[];
  meters: [number, number][];
  key: number | null;
  trackNames: Record<number, string>;
}

const MAX_TRACKS = 64;
const corrupt = (): never => {
  throw new Error('El archivo MIDI está dañado.');
};

class Reader {
  p = 0;
  constructor(private d: DataView) {}
  peek(): number {
    if (this.p >= this.d.byteLength) corrupt();
    return this.d.getUint8(this.p);
  }
  u8(): number {
    const v = this.peek();
    this.p++;
    return v;
  }
  u16(): number {
    return (this.u8() << 8) | this.u8();
  }
  u32(): number {
    return ((this.u16() << 16) >>> 0) + this.u16();
  }
  str(n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8());
    return s;
  }
  vlq(): number {
    let v = 0;
    let b: number;
    do {
      b = this.u8();
      v = (v << 7) | (b & 0x7f);
    } while (b & 0x80);
    return v;
  }
}

interface TrackCtx {
  r: Reader;
  f: MidiFile;
  track: number;
  tick: number;
  open: Map<number, number[]>;
}

function readMeta(c: TrackCtx): void {
  const type = c.r.u8();
  const len = c.r.vlq();
  const start = c.r.p;
  if (type === 0x51 && len >= 3) c.f.tempos.push((c.r.u8() << 16) | (c.r.u8() << 8) | c.r.u8());
  else if (type === 0x58 && len >= 2) c.f.meters.push([c.r.u8(), 2 ** c.r.u8()]);
  else if (type === 0x59 && len >= 1 && c.f.key === null) c.f.key = (c.r.u8() << 24) >> 24;
  else if (type === 0x03 && !(c.track in c.f.trackNames)) c.f.trackNames[c.track] = c.r.str(len);
  c.r.p = start + len;
}

function readChannel(c: TrackCtx, status: number): void {
  const hi = status & 0xf0;
  const ch = status & 0x0f;
  const a = c.r.u8();
  const v = hi === 0xc0 || hi === 0xd0 ? 0 : c.r.u8();
  const key = ch * 128 + a;
  if (hi === 0x90 && v > 0) c.open.set(key, [...(c.open.get(key) ?? []), c.tick]);
  else if (hi === 0x80 || hi === 0x90) {
    const starts = c.open.get(key);
    const s = starts?.shift();
    if (s !== undefined) c.f.notes.push({ track: c.track, channel: ch, pitch: a, start: s, end: c.tick });
  }
}

/** Running status separado: los eventos meta y sysex no lo cambian (D6 de formats-spec). */
function readTrack(c: TrackCtx, end: number): void {
  let running = 0;
  while (c.r.p < end) {
    c.tick += c.r.vlq();
    const b = c.r.peek();
    const status = b & 0x80 ? (c.r.p++, b) : running;
    if (status === 0xff) readMeta(c);
    else if (status === 0xf0 || status === 0xf7) c.r.p += c.r.vlq();
    else if (status >= 0x80) {
      running = status;
      readChannel(c, status);
    } else corrupt();
  }
}

export function readMidi(buf: ArrayBuffer): MidiFile {
  const r = new Reader(new DataView(buf));
  if (buf.byteLength < 14 || r.str(4) !== 'MThd') throw new Error('No es un archivo MIDI.');
  const hl = r.u32();
  r.u16();
  const tracks = Math.min(MAX_TRACKS, r.u16());
  const division = r.u16();
  if (division & 0x8000) throw new Error('Formato MIDI no compatible.');
  r.p = 8 + hl;
  const f: MidiFile = { division, notes: [], tempos: [], meters: [], key: null, trackNames: {} };
  for (let t = 0; t < tracks && r.p < buf.byteLength; t++) {
    if (r.str(4) !== 'MTrk') break;
    const len = r.u32();
    const end = Math.min(buf.byteLength, r.p + len);
    readTrack({ r, f, track: t, tick: 0, open: new Map() }, end);
    r.p = end;
  }
  return f;
}
