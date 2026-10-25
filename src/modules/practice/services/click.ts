/** Pulso breve, distinto de la voz instrumental y cancelable por el mismo transporte. */
export function metronomeClick(
  audio: { context: AudioContext; output: AudioNode; track: (source: AudioScheduledSourceNode) => void },
  when: number,
  accent: boolean,
): void {
  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();
  oscillator.frequency.value = accent ? 1200 : 800;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(accent ? 0.3 : 0.18, when + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
  oscillator.connect(gain);
  gain.connect(audio.output);
  oscillator.addEventListener(
    'ended',
    () => {
      oscillator.disconnect();
      gain.disconnect();
    },
    { once: true },
  );
  audio.track(oscillator);
  oscillator.start(when);
  oscillator.stop(when + 0.045);
}
