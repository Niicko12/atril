import { useCallback } from 'react';
import type { Midi } from '@/core';
import { playbackEngine } from '@/modules/playback';
import { useScoreStore } from '../store/score.store';
import { selectInstrument } from '../store/selectors';

const FLASH_MS = 170;

function flash(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.add('down');
  setTimeout(() => el.classList.remove('down'), FLASH_MS);
}

/** Entrada de una nota desde cualquier superficie: sonido inmediato, destello y nota (editor-spec 8). */
export function useNoteInput() {
  const addNote = useScoreStore((s) => s.addNote);
  const timbre = useScoreStore((s) => selectInstrument(s).timbre);
  const instrumentId = useScoreStore((s) => s.score.instrumentId);
  return useCallback(
    (midi: Midi, el?: HTMLElement | null) => {
      playbackEngine.unlock();
      addNote(midi);
      playbackEngine.preview(midi, timbre, instrumentId);
      flash(el);
    },
    [addNote, timbre, instrumentId],
  );
}
