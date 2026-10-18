// AudioContext simulado para tests (playback-spec 20): registra nodos, conexiones, start/stop y rampas.
export class FakeParam {
  value = 0;
  calls: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) {
    this.calls.push(['set', v, t]);
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push(['exp', v, t]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(['lin', v, t]);
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.calls.push(['target', v, t]);
    return this;
  }
  cancelScheduledValues(t: number) {
    this.calls.push(['cancel', 0, t]);
    return this;
  }
}

export class FakeNode extends EventTarget {
  connected: unknown[] = [];
  constructor(
    public kind: string,
    public ctx: FakeAudioContext,
  ) {
    super();
    ctx.nodes.push(this);
  }
  connect(n: unknown) {
    this.connected.push(n);
    return n;
  }
  disconnect() {}
}

export class FakeSource extends FakeNode {
  started: number | null = null;
  stopped: number | null = null;
  stopCalls = 0;
  type = '';
  buffer: unknown = null;
  loop = false;
  frequency = new FakeParam();
  detune = new FakeParam();
  start(t = 0) {
    this.started = t;
  }
  stop(t = 0) {
    this.stopped = t;
    this.stopCalls++;
  }
}

export class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  nodes: FakeNode[] = [];
  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  destination = { kind: 'destination' };
  constructor() {
    FakeAudioContext.last = this;
  }
  resume() {
    return Promise.resolve();
  }
  createGain() {
    const n = Object.assign(new FakeNode('gain', this), { gain: new FakeParam() });
    return n;
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode('comp', this), { threshold: new FakeParam(), ratio: new FakeParam() });
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode('biquad', this), { type: '', frequency: new FakeParam(), Q: new FakeParam() });
  }
  createOscillator() {
    return new FakeSource('osc', this);
  }
  createBufferSource() {
    return new FakeSource('buffer', this);
  }
  createBuffer(_ch: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
  }
  sources(kind?: string) {
    return this.nodes.filter((n): n is FakeSource => n instanceof FakeSource && (!kind || n.kind === kind));
  }
}
