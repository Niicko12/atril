// Un solo AudioContext para toda la app (playback-spec 4).
type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function create(): AudioContext {
  const C = (globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext) as Ctor;
  const c = new C({ latencyHint: 'interactive' });
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master = c.createGain();
  master.gain.value = 0.55;
  master.connect(comp);
  comp.connect(c.destination);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
    });
  }
  return c;
}

/** ¿El navegador tiene Web Audio? Sin él no hay sonido, pero el editor funciona (playback-spec 16, S13). */
export function isAudioSupported(): boolean {
  return typeof globalThis.AudioContext !== 'undefined' || 'webkitAudioContext' in globalThis;
}

export function getContext(): AudioContext {
  ctx ??= create();
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  return ctx;
}

export function getMaster(): GainNode {
  getContext();
  return master as GainNode;
}

/** Solo para tests. */
export function resetContextForTests(): void {
  ctx = null;
  master = null;
}
