import { toast } from '@/shared/toast';
import { S } from '../strings';
import { EAR_LIMITS } from '@/core/analysis';
import { playbackEngine } from '@/modules/playback';
import type { DecodedAudio } from '../types';
import { regionOf, releaseAudio, stretched } from './ear.service';

export interface PlayerState {
  pos: number;
  playing: boolean;
  a: number | null;
  b: number | null;
  speed: number;
  preparing: boolean;
}

/** Reproductor de "De oído": región, bucle A-B y velocidad sin cambio de tono (ear-spec 5.4, 6, 7). */
export class AudioPlayer {
  state: PlayerState = { pos: 0, playing: false, a: null, b: null, speed: 1, preparing: false };
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private raf = 0;
  private playVersion = 0;
  private listeners = new Set<(s: PlayerState) => void>();
  private offPlayback: () => void = () => {};

  private onVisibility = () => {
    if (document.hidden) this.stop();
  };
  constructor(private audio: DecodedAudio) {}

  /** Si empieza a sonar la partitura, se detiene el audio (y viceversa en play). */
  attach(): void {
    this.offPlayback = playbackEngine.subscribe((p) => p && this.stop());
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  subscribe(fn: (s: PlayerState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<PlayerState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  private out(): GainNode {
    const c = playbackEngine.getContext();
    if (!this.gain) {
      this.gain = c.createGain();
      this.gain.connect(c.destination);
    }
    return this.gain;
  }

  private async source(from: number, region: ReturnType<typeof regionOf>) {
    const c = playbackEngine.getContext();
    const src = c.createBufferSource();
    if (this.state.speed === 1) {
      src.buffer = this.audio.buffer;
      Object.assign(src, region.loop ? { loop: true, loopStart: region.a, loopEnd: region.b } : {});
      return { src, offset: from, seg: null };
    }
    const seg: [number, number] = region.loop
      ? [region.a, region.b]
      : [from, Math.min(region.b, from + EAR_LIMITS.stretchSegmentSec)];
    this.set({ preparing: true });
    src.buffer = await stretched(this.audio, seg, this.state.speed);
    if (region.loop) Object.assign(src, { loop: true, loopStart: 0, loopEnd: src.buffer.duration });
    return { src, offset: (from - seg[0]) / this.state.speed, seg };
  }

  async play(): Promise<void> {
    playbackEngine.stopAll();
    playbackEngine.unlock();
    this.stopSource();
    const version = ++this.playVersion;
    const region = regionOf(this.audio.duration, this.state.a, this.state.b);
    const from = this.state.pos < region.a || this.state.pos >= region.b - 0.05 ? region.a : this.state.pos;
    try {
      const { src, offset, seg } = await this.source(from, region);
      if (version !== this.playVersion) {
        src.disconnect();
        return;
      }
      src.connect(this.out());
      src.start(0, Math.max(0, offset));
      src.onended = () => this.src === src && this.stop();
      this.src = src;
      this.set({ playing: true, preparing: false });
      this.track(playbackEngine.getContext().currentTime, from, region, seg);
    } catch (error) {
      if (version !== this.playVersion) return;
      this.set({ playing: false, preparing: false });
      throw error;
    }
  }

  private track(t0: number, p0: number, region: ReturnType<typeof regionOf>, seg: [number, number] | null): void {
    const c = playbackEngine.getContext();
    const step = () => {
      if (!this.state.playing) return;
      let p = p0 + (c.currentTime - t0) * this.state.speed;
      if (region.loop && p >= region.b) p = region.a + ((p - region.a) % (region.b - region.a));
      else if (seg) p = Math.min(p, seg[1]);
      this.set({ pos: Math.min(p, this.audio.duration) });
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private stopSource(): void {
    const s = this.src;
    this.src = null;
    try {
      s?.stop();
    } catch {
      // ya terminó
    }
    cancelAnimationFrame(this.raf);
  }

  stop(): void {
    this.playVersion++;
    this.stopSource();
    if (this.state.playing || this.state.preparing) this.set({ playing: false, preparing: false });
  }

  /** Cambios que reinician la reproducción si estaba sonando. */
  update(patch: Partial<Pick<PlayerState, 'pos' | 'a' | 'b' | 'speed'>>): void {
    const wasPlaying = this.state.playing || this.state.preparing;
    this.set(patch);
    if (wasPlaying) void this.play().catch(() => toast(S.errPlayback));
  }

  setLoop(a: number, b: number): void {
    const lo = Math.min(Math.max(0, a), Math.max(0, this.audio.duration - EAR_LIMITS.loopMinSec));
    const hi = Math.min(this.audio.duration, Math.max(b, lo + EAR_LIMITS.loopMinSec));
    this.update({ a: lo, b: hi, pos: lo });
  }

  dispose(): void {
    this.stop();
    this.offPlayback();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.gain?.disconnect();
    this.gain = null;
    releaseAudio(this.audio);
    this.listeners.clear();
  }
}
