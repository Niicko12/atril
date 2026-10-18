// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { AppShell } from './app-shell';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

describe('AppShell', () => {
  it('muestra la marca, la hoja, el estado y el dock con el piano', () => {
    render(<AppShell />);
    expect(screen.getByRole('heading', { name: 'Atril' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Partitura: Himno de la alegría, Piano/ })).toBeInTheDocument();
    expect(screen.getByText(/62 notas · 16 compases/)).toBeInTheDocument();
    expect(screen.getByLabelText('Teclado de piano')).toBeInTheDocument();
  });
});
