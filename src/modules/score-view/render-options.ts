import type { AbcVisualParams } from 'abcjs';
import type { Instrument, View } from '@/core';

type Tablature = NonNullable<AbcVisualParams['tablature']>;

/** ¿Se dibuja tablatura? (notation-core-spec 14.1) */
export const showsTab = (showTab: boolean, instrument: Instrument, view: View): boolean =>
  showTab && !!instrument.tab && view === 'written';

function tablature(instrument: Instrument): Tablature {
  if (instrument.tab === 'guitar') return [{ instrument: 'guitar', label: 'TAB' }];
  return [{ instrument: 'guitar', label: 'TAB', tuning: ['E,,', 'A,,', 'D,', 'G,'] }];
}

const SCREEN = { paddingtop: 4, paddingleft: 0, paddingright: 0, minSpacing: 1.5, color: '#16181a' } as const;
const EXPORT = { paddingleft: 10, paddingright: 10, minSpacing: 1.6, color: '#000000' } as const;

const perLine = (width: number): number => (width < 480 ? 2 : width < 720 ? 3 : 4);

/** Opciones de abcjs para pantalla y exportación (notation-core-spec 12.3). */
export function scoreRenderOptions(
  mode: 'screen' | 'export',
  paperWidth: number,
  tab: Instrument | null,
): AbcVisualParams {
  const p = mode === 'screen' ? SCREEN : EXPORT;
  const width = mode === 'screen' ? Math.max(260, paperWidth - 30) : 740;
  const opts: AbcVisualParams = {
    staffwidth: width,
    paddingleft: p.paddingleft,
    paddingright: p.paddingright,
    wrap: {
      minSpacing: p.minSpacing,
      maxSpacing: 2.6,
      preferredMeasuresPerLine: mode === 'screen' ? perLine(width) : 4,
    },
    foregroundColor: p.color,
  };
  if (mode === 'screen')
    Object.assign(opts, { paddingtop: SCREEN.paddingtop, add_classes: true, selectionColor: '#b3123e' });
  if (tab) opts.tablature = tablature(tab);
  return opts;
}
