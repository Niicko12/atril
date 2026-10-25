import { fitGrid, ROLL_LABEL } from './grid-layout';
const base = { page: 0, bar: 16, width: 1200, height: 300, zoom: 0 };
describe('rejilla ajustada al espacio disponible', () => {
  it('una pieza corta ocupa el ancho sin añadir compases vacíos ni desplazamiento vertical', () => {
    const grid = fitGrid({
      ...base,
      notes: [
        { p: 60, d: 4 },
        { p: 72, d: 4 },
      ],
    });
    expect(grid.bars).toBe(1);
    expect(grid.width).toBeCloseTo(base.width);
    expect((grid.rows + 2) * grid.row).toBeLessThanOrEqual(base.height);
    expect(grid.unit * 16 + ROLL_LABEL).toBeCloseTo(base.width);
  });
  it('la última página muestra solo el compás que queda y conserva notas ligadas', () => {
    const grid = fitGrid({
      ...base,
      page: 1,
      notes: [
        { p: 60, d: 48 },
        { p: 62, d: 32 },
      ],
    });
    expect(grid.first).toBe(64);
    expect(grid.bars).toBe(1);
    expect(grid.events.map((n) => n.index)).toEqual([1]);
    expect(grid.low).toBe(60);
    expect(grid.high).toBe(64);
  });
  it('conserva el zoom manual y no comprime excesivamente registros MIDI extremos', () => {
    const grid = fitGrid({
      ...base,
      zoom: 28,
      notes: [
        { p: 0, d: 8 },
        { p: 127, d: 8 },
      ],
    });
    expect(grid.unit).toBe(28);
    expect(grid.row).toBe(12);
    expect(grid.width).toBe(ROLL_LABEL + 16 * 28);
    expect(grid.low).toBe(0);
    expect(grid.high).toBe(127);
  });
});
