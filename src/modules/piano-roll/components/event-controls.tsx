import { MAX_NOTES, midiName, type Note } from '@/core';
import { buttonStyles as b } from '@/shared/components/overlay';
import { clamp, deleteNote, editNote, insertNote, reorder } from '../services/draft';
import type { DraftChange } from '../types';
import { S } from '../strings';
import styles from './piano-roll.module.css';

type Props = { notes: Note[]; selected: number; change(next: DraftChange): void; select(index: number): void };
const numberOf = (value: string) => (value.trim() === '' ? NaN : Number(value));
function EventFields({ notes, selected, change, select }: Props) {
  const note = notes[selected];
  const edit = (patch: Partial<Note>) => change({ notes: editNote(notes, selected, patch), selection: selected });
  return (
    <>
      <div className={styles.fields}>
        <label>
          {S.selected}
          <input
            type="number"
            min="1"
            max={notes.length}
            value={note ? selected + 1 : ''}
            disabled={!notes.length}
            onChange={(e) => {
              const n = numberOf(e.target.value);
              if (Number.isFinite(n)) select(clamp(n - 1, 0, notes.length - 1));
            }}
          />
        </label>
        <label>
          {S.pitch}
          <input
            type="number"
            min="0"
            max="127"
            value={note?.p ?? ''}
            disabled={!note || note.p === null}
            onChange={(e) => {
              const n = numberOf(e.target.value);
              if (Number.isFinite(n)) edit({ p: clamp(n, 0, 127) });
            }}
          />
        </label>
        <label>
          {S.duration}
          <input
            type="number"
            min="1"
            max="48"
            value={note?.d ?? ''}
            disabled={!note}
            onChange={(e) => {
              const n = numberOf(e.target.value);
              if (Number.isFinite(n)) edit({ d: clamp(n, 1, 48) });
            }}
          />
        </label>
      </div>
      {note && (
        <p className={styles.help} role="status">
          {S.note(selected, note.p === null ? S.silence : midiName(note.p), note.d)}
          {note.c ? ` · ${note.c}` : ''}
        </p>
      )}
    </>
  );
}

export function EventControls({ notes, selected, change, select }: Props) {
  const note = notes[selected];
  const edit = (patch: Partial<Note>) => change({ notes: editNote(notes, selected, patch), selection: selected });
  return (
    <div className={styles.controls}>
      <EventFields notes={notes} selected={selected} change={change} select={select} />
      <details className={styles.secondary}>
        <summary>Más acciones de la nota</summary>
        <div className={styles.actions}>
          <button
            type="button"
            className={b.btn}
            disabled={!note || selected === 0}
            onClick={() => change(reorder(notes, selected, selected - 1))}
          >
            {S.earlier}
          </button>
          <button
            type="button"
            className={b.btn}
            disabled={!note || selected === notes.length - 1}
            onClick={() => change(reorder(notes, selected, selected + 1))}
          >
            {S.later}
          </button>
          <button
            type="button"
            className={b.btn}
            disabled={!note}
            onClick={() => edit({ p: note?.p === null ? 60 : null })}
          >
            {note?.p === null ? 'Convertir en nota' : 'Convertir en silencio'}
          </button>
          <button type="button" className={b.btn} disabled={!note} onClick={() => change(deleteNote(notes, selected))}>
            {S.delete}
          </button>
        </div>
      </details>
      <div className={styles.actions}>
        <button
          type="button"
          className={b.btn}
          disabled={notes.length >= MAX_NOTES}
          onClick={() => change(insertNote(notes, selected, note?.p ?? 60))}
        >
          {S.add}
        </button>
        <button
          type="button"
          className={b.btn}
          disabled={notes.length >= MAX_NOTES}
          onClick={() => change(insertNote(notes, selected, null))}
        >
          {S.rest}
        </button>
        {notes.length >= MAX_NOTES && <span role="status">{S.limit}</span>}
      </div>
    </div>
  );
}
