// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { HelpOverlay } from './help-overlay';
import { copyDiagnostic, diagnostic } from '../services/diagnostic';
import { LICENSES, S } from '../strings';

it('explica privacidad, respaldo, accesos y licencias sin pedir cuentas', () => {
  const ear = vi.fn(),
    library = vi.fn();
  render(<HelpOverlay onClose={() => {}} onEar={ear} onLibrary={library} />);
  expect(screen.getByRole('dialog', { name: S.title })).toBeInTheDocument();
  fireEvent.click(screen.getByText(S.ear));
  fireEvent.click(screen.getByText(S.openEar));
  expect(ear).toHaveBeenCalled();
  fireEvent.click(screen.getByText(S.backup));
  fireEvent.click(screen.getByText(S.library));
  expect(library).toHaveBeenCalled();
  expect(screen.getByText(S.sharedDevice)).toBeVisible();
  fireEvent.click(screen.getByText(S.licenses));
  for (const [name, license, file] of LICENSES)
    expect(screen.getByRole('link', { name: `${name} · ${license} ↗` })).toHaveAttribute('href', `/licenses/${file}`);
});
it('diagnóstico sin títulos, notas o audio y copia con recuperación visible', async () => {
  const text = diagnostic();
  expect(text).toContain('Atril · diagnóstico local');
  expect(text).toContain('Contexto seguro:');
  const writeText = vi.fn().mockResolvedValue(undefined);
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  try {
    await expect(copyDiagnostic(text)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(text);
    writeText.mockRejectedValue(new Error('denegado'));
    render(<HelpOverlay onClose={() => {}} onEar={() => {}} onLibrary={() => {}} />);
    fireEvent.click(screen.getByText(S.diagnostic));
    fireEvent.click(screen.getByText(S.copy));
    expect(await screen.findByText(S.select)).toBeInTheDocument();
    expect(screen.getByLabelText(S.output)).toHaveValue(text);
  } finally {
    if (previous) Object.defineProperty(navigator, 'clipboard', previous);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});
