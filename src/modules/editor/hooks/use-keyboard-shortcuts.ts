import { useEffect } from 'react';
import { playbackEngine } from '@/modules/playback';
import { toast } from '@/shared/toast';
import { useScoreStore } from '../store/score.store';
import { S } from '../strings';
import type { BaseDuration } from '../types';

/** Teclas de nota en orden cromático desde Do: a=Do, w=Do♯, s=Re… l=Re+1 (editor-spec 8.4, legacy KMAP). */
const KMAP: Readonly<Record<string, number>> = Object.fromEntries([...'awsedftgyhujkol'].map((k, i) => [k, i]));
const DURS: readonly BaseDuration[] = [16, 8, 4, 2, 1];

interface Ctx {
  e: KeyboardEvent;
  enter(midi: number): void;
  togglePlay(): void;
}
type Action = (c: Ctx) => void;

const store = () => useScoreStore.getState();
const once =
  (fn: Action): Action =>
  (c) => {
    if (!c.e.repeat) fn(c);
  };
const octave =
  (dir: 1 | -1): Action =>
  () =>
    toast(S.octaveToast(store().setKeyboardOctave(dir)));

/** Tabla de teclas (editor-spec 8.4). Las de nota se resuelven con KMAP. */
const ACTIONS: Readonly<Record<string, Action>> = {
  z: octave(-1),
  x: octave(1),
  '.': () => store().toggleDot(),
  '0': once(() => store().addNote(null)),
  r: once(() => store().addNote(null)),
  backspace: once(() => store().deleteNote()),
  delete: once(() => store().deleteNote()),
  ' ': (c) => c.togglePlay(),
  arrowleft: () => store().moveSelection(-1),
  arrowright: () => store().moveSelection(1),
  arrowup: () => store().octaveLast(1),
  arrowdown: () => store().octaveLast(-1),
  escape: () => store().clearSelection(),
  ...Object.fromEntries(DURS.map((d, i): [string, Action] => [String(i + 1), () => store().setDuration(d)])),
};

/** Ctrl/Cmd+Z deshace; Ctrl/Cmd+Shift+Z y Ctrl+Y rehacen. */
function historyKeys(e: KeyboardEvent): boolean {
  const k = e.key.toLowerCase();
  if (k === 'z') {
    if (e.shiftKey) store().redo();
    else store().undo();
    return true;
  }
  if (k === 'y' && e.ctrlKey) {
    store().redo();
    return true;
  }
  return false;
}

function noteKeys(c: Ctx): boolean {
  const k = c.e.key.toLowerCase();
  const offset = KMAP[k];
  if (offset !== undefined) {
    if (!c.e.repeat) c.enter(12 * (store().keyboardOctave + 1) + offset);
    return true;
  }
  const action = ACTIONS[k];
  if (!action) return false;
  action(c);
  return true;
}

const isTyping = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  return (
    !!el && (/^(input|select|textarea|button|a|summary)$/i.test(el.tagName ?? '') || el.isContentEditable === true)
  );
};

export interface ShortcutOptions {
  enter(midi: number): void;
  togglePlay(): void;
  /** Si hay un overlay abierto los atajos no actúan (Escape lo maneja el overlay). */
  isOverlayOpen?(): boolean;
}

/** Atajos globales del editor; ignora teclas mientras se escribe en un campo. */
export function useKeyboardShortcuts({ enter, togglePlay, isOverlayOpen }: ShortcutOptions): void {
  useEffect(() => {
    const handle = (e: KeyboardEvent): boolean => {
      if (isTyping(e.target) || e.altKey || isOverlayOpen?.()) return false;
      if (e.metaKey || e.ctrlKey) return historyKeys(e);
      playbackEngine.unlock();
      return noteKeys({ e, enter, togglePlay });
    };
    const listener = (e: KeyboardEvent) => {
      if (!e.defaultPrevented && handle(e)) e.preventDefault();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [enter, togglePlay, isOverlayOpen]);
}
