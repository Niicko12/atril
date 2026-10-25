import { scoreRenderOptions } from './render-options';
describe('densidad de compases según pantalla', () => {
  it.each([
    [320, 2],
    [640, 3],
    [1024, 4],
    [1920, 7],
    [2560, 10],
    [4000, 12],
  ])('ancho %i: preferencia %i', (width, bars) => {
    expect(scoreRenderOptions('screen', width, null).wrap).toMatchObject({ preferredMeasuresPerLine: bars });
  });
  it('mantiene cuatro compases en exportación aunque el monitor sea muy ancho', () => {
    expect(scoreRenderOptions('export', 2560, null).wrap).toMatchObject({ preferredMeasuresPerLine: 4 });
    expect(scoreRenderOptions('export', 2560, null).staffwidth).toBe(740);
  });
});
