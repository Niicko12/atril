/** Iconos de figuras (portados de `noteIcon()` de legacy). */
export function NoteIcon({ units }: { units: number }) {
  const whole = units === 16;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {whole ? (
        <ellipse cx="12" cy="15" rx="5.2" ry="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      ) : (
        <ellipse
          cx="10"
          cy="17"
          rx="4.4"
          ry="3.1"
          transform="rotate(-22 10 17)"
          {...(units === 8 ? { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 } : { fill: 'currentColor' })}
        />
      )}
      {!whole && <line x1="14" y1="16" x2="14" y2="3" stroke="currentColor" strokeWidth="1.6" />}
      {units <= 2 && <path d="M14 3c1 3 5 4 4 9 0-3-2-4-4-5z" fill="currentColor" />}
      {units === 1 && <path d="M14 7c1 3 5 4 4 9 0-3-2-4-4-5z" fill="currentColor" />}
    </svg>
  );
}

export function DotIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    </svg>
  );
}

export function RestIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 3l5 5-4 4 4 5c-3-1-5 0-4 3-3-2-3-5 0-6l-4-4 4-3z" fill="currentColor" />
    </svg>
  );
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function UndoIcon({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined} {...stroke}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 010 12h-3" />
    </svg>
  );
}

export function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M21 5H9l-6 7 6 7h12z" />
      <path d="M12 9l6 6M18 9l-6 6" />
    </svg>
  );
}

export function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {playing ? (
        <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
      ) : (
        <path d="M8 5l12 7-12 7z" fill="currentColor" />
      )}
    </svg>
  );
}
