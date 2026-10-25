import { canShareFiles } from './download';

it('solo ofrece compartir archivo cuando el navegador implementa ambas funciones', () => {
  vi.stubGlobal('navigator', { canShare: vi.fn(() => true), share: undefined });
  expect(canShareFiles('Atril.pdf', new Blob(['pdf'], { type: 'application/pdf' }))).toBe(false);
  vi.stubGlobal('navigator', { canShare: vi.fn(() => true), share: vi.fn() });
  expect(canShareFiles('Atril.pdf', new Blob(['pdf'], { type: 'application/pdf' }))).toBe(true);
});
