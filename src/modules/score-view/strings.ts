export const S = {
  empty: 'Toca el teclado de abajo para escribir notas',
  renderFailed: 'No se pudo dibujar la partitura.',
  tabFailed: 'No se pudo dibujar la tablatura',
  sheetLabel: (title: string, instrument: string, measures: number) =>
    `Partitura: ${title || 'Sin título'}, ${instrument}, ${measures} compases`,
  counts: (notes: number, measures: number) => `${notes} notas · ${measures} compases`,
  writtenKey: (key: string) => `Tonalidad escrita: ${key}`,
  outOfRange: (n: number, instrument: string, range: string) =>
    `${n} ${n === 1 ? 'nota fuera' : 'notas fuera'} del rango de ${instrument.toLowerCase()} (${range})`,
  selected: (i: number, what: string) => `Nota ${i + 1} seleccionada (${what}) · toca otra nota para cambiarla`,
  rest: 'silencio',
} as const;
