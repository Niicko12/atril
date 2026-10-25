import { useSyncExternalStore } from 'react';
import { soundStatus } from '../status';
export function SoundStatus() {
  const message = useSyncExternalStore(soundStatus.subscribe, soundStatus.get, soundStatus.get);
  return (
    <small role="status" style={{ color: 'var(--muted)' }}>
      {message}
    </small>
  );
}
