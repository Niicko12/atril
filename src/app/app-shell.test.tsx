// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
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
  it('abre Ayuda con información de respaldo y vuelve al editor', async () => {
    render(<AppShell />);
    const help = screen.getByRole('button', { name: 'Ayuda' });
    help.focus();
    fireEvent.click(help);
    expect(await screen.findByRole('dialog', { name: 'Ayuda y acerca de Atril' })).toBeInTheDocument();
    expect(screen.getByText('Tus partituras y copias')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(help).toHaveFocus();
  });
  it('muestra la marca, la hoja, el estado y el dock con el piano', () => {
    render(<AppShell />);
    expect(screen.getByRole('heading', { name: 'Atril' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Partitura: Himno de la alegría, Piano/ })).toBeInTheDocument();
    expect(screen.getByText(/62 notas · 16 compases/)).toBeInTheDocument();
    expect(screen.getByLabelText('Teclado de piano')).toBeInTheDocument();
  });
});
