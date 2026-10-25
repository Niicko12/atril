import { useEffect, useState } from 'react';
import { useScoreStore } from '@/modules/editor';
import { onSaved, useLibraryVersion } from '../services/autosave.service';

type Msg = { type: 'open' | 'saved' | 'close'; tab: string; id?: string; updatedAt?: string };
const HEARTBEAT_MS = 10000;
const STALE_MS = 25000;

function isMessage(value: unknown): value is Msg {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<Msg>;
  return (
    typeof m.tab === 'string' &&
    ['open', 'saved', 'close'].includes(m.type ?? '') &&
    (m.id === undefined || typeof m.id === 'string') &&
    (m.updatedAt === undefined || (typeof m.updatedAt === 'string' && Number.isFinite(Date.parse(m.updatedAt))))
  );
}

/** Latidos y limpieza del canal, ligados a la vida de la pestaña. */
function maintainChannel(
  ch: BroadcastChannel,
  send: (m: Omit<Msg, 'tab'>) => void,
  tick: () => void,
  saved: () => void,
): () => void {
  send({ type: 'open', id: useScoreStore.getState().score.id });
  const beat = setInterval(() => {
    send({ type: 'open', id: useScoreStore.getState().score.id });
    tick();
  }, HEARTBEAT_MS);
  const offSaved = onSaved((id, updatedAt) => {
    send({ type: 'saved', id, updatedAt });
    saved();
  });
  const bye = () => send({ type: 'close' });
  addEventListener('pagehide', bye);
  return () => {
    bye();
    clearInterval(beat);
    offSaved();
    removeEventListener('pagehide', bye);
    ch.close();
  };
}

/** Avisa si la misma partitura está abierta en otra pestaña (library-spec 14). */
export function useTabGuard(): { otherTabOpen: boolean; otherTabSaved: boolean } {
  const id = useScoreStore((s) => s.score.id);
  const [others, setOthers] = useState<Record<string, { id: string | undefined; at: number }>>({});
  const [externalSave, setExternalSave] = useState<{ id: string; updatedAt: string | undefined } | null>(null);
  const savedAt = useScoreStore((s) => s.score.savedAt);
  const [tab] = useState(() => crypto.randomUUID());
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('atril');
    const send = (m: Omit<Msg, 'tab'>) => ch.postMessage({ ...m, tab });
    ch.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (!isMessage(m) || m.tab === tab) return;
      if (m.type === 'close') setOthers((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== m.tab)));
      else setOthers((o) => ({ ...o, [m.tab]: { id: m.id, at: Date.now() } }));
      if (m.type === 'saved') {
        useLibraryVersion.getState().bump();
        if (m.id === useScoreStore.getState().score.id) setExternalSave({ id: m.id, updatedAt: m.updatedAt });
      }
    };
    return maintainChannel(
      ch,
      send,
      () => setNow(Date.now()),
      () => setExternalSave(null),
    );
  }, [id, tab]);

  const otherTabOpen = Object.values(others).some((o) => o.id === id && (now === 0 || now - o.at < STALE_MS));
  const otherTabSaved =
    !!externalSave &&
    externalSave.id === id &&
    (!externalSave.updatedAt || !savedAt || externalSave.updatedAt > savedAt);
  return { otherTabOpen, otherTabSaved };
}
