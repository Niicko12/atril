/** Nodos fuente vivos; cada uno se quita al terminar (playback-spec 12). */
const live = new Set<AudioScheduledSourceNode>();

export function track(node: AudioScheduledSourceNode): void {
  live.add(node);
  node.addEventListener('ended', () => live.delete(node));
}

export function stopVoices(): void {
  for (const n of live) {
    try {
      n.stop();
    } catch {
      // ya detenido
    }
  }
  live.clear();
}

export const liveCount = (): number => live.size;
