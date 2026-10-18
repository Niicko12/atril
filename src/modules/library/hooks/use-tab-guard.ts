import { useEffect, useState } from 'react';
import { useScoreStore } from '@/modules/editor';
import { onSaved, useLibraryVersion } from '../services/autosave.service';

type Msg = { type: 'open' | 'saved' | 'close'; tab: string; id?: string };
const HEARTBEAT_MS = 10000;
const STALE_MS = 25000;

/** Avisa si la misma partitura está abierta en otra pestaña (library-spec 14). */
export function useTabGuard(): { otherTabOpen: boolean; otherTabSaved: boolean } {
  const id = useScoreStore((s) => s.score.id);
  const [others, setOthers] = useState<Record<string, { id: string | undefined; at: number }>>({});
  const [otherTabSaved, setOtherTabSaved] = useState(false);
  const [tab] = useState(() => crypto.randomUUID());
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('atril');
    const send = (m: Omit<Msg, 'tab'>) => ch.postMessage({ ...m, tab });
    ch.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (m.type === 'close') setOthers((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== m.tab)));
      else setOthers((o) => ({ ...o, [m.tab]: { id: m.id, at: Date.now() } }));
      if (m.type === 'saved') {
        useLibraryVersion.getState().bump();
        if (m.id === useScoreStore.getState().score.id) setOtherTabSaved(true);
      }
    };
    send({ type: 'open', id });
    const beat = setInterval(() => {
      send({ type: 'open', id: useScoreStore.getState().score.id });
      setNow(Date.now());
    }, HEARTBEAT_MS);
    const offSaved = onSaved((savedId) => send({ type: 'saved', id: savedId }));
    const bye = () => send({ type: 'close' });
    addEventListener('pagehide', bye);
    return () => {
      bye();
      clearInterval(beat);
      offSaved();
      removeEventListener('pagehide', bye);
      ch.close();
    };
  }, [id, tab]);

  const otherTabOpen = Object.values(others).some((o) => o.id === id && (now === 0 || now - o.at < STALE_MS));
  return { otherTabOpen, otherTabSaved };
}
