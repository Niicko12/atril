import { getContext } from './context';
import { silentWav } from './silent-wav';

let unlocked = false;

/** Desbloquea el audio en el primer gesto y lo hace sonar con el interruptor de silencio en iPhone (playback-spec 5). */
export function unlock(): void {
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
  } catch {
    // API opcional
  }
  const c = getContext();
  if (unlocked) return;
  unlocked = true;
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch {
    // no crítico
  }
  try {
    const el = document.createElement('audio');
    el.setAttribute('x-webkit-airplay', 'deny');
    el.preload = 'auto';
    el.loop = true;
    el.src = silentWav();
    void el.play()?.catch(() => {});
  } catch {
    // no crítico fuera de iOS
  }
}

export function resetUnlockForTests(): void {
  unlocked = false;
}
