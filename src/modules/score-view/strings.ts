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
  selected: (i: number, what: string) =>
    `Nota ${i + 1} seleccionada (${what}) · arrastra con el mouse: ↕ altura · ↔ posición`,
  deleteSelected: 'Borrar nota',
  earlier: 'Mover nota antes',
  later: 'Mover nota después',
  rest: 'silencio',
  navigation: 'Navegar por compases',
  previousMeasure: 'Compás anterior',
  nextMeasure: 'Compás siguiente',
  measure: 'Compás',
  goToMeasure: 'Ir al compás',
  ofMeasures: (count: number) => `de ${count}`,
  playMeasure: 'Escuchar desde este compás',
  playSelected: 'Desde la nota seleccionada',
  playBeginning: 'Desde el inicio',
  stop: 'Detener',
} as const;
