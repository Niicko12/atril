// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { LazyPanelBoundary } from './lazy-panel';
function Broken(): never {
  throw new Error('chunk ausente');
}
it('un fallo de carga permite volver sin desmontar el editor', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {}),
    close = vi.fn();
  try {
    render(
      <>
        <input aria-label="Título conservado" defaultValue="Mi melodía" />
        <LazyPanelBoundary onClose={close}>
          <Broken />
        </LazyPanelBoundary>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Tu partitura sigue en el editor');
    expect(screen.getByLabelText('Título conservado')).toHaveValue('Mi melodía');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la partitura' }));
    expect(close).toHaveBeenCalled();
  } finally {
    error.mockRestore();
  }
});
it('una herramienta sana se muestra sin alterar el contenido', () => {
  render(
    <LazyPanelBoundary onClose={() => {}}>
      <p>Contenido disponible</p>
    </LazyPanelBoundary>,
  );
  expect(screen.getByText('Contenido disponible')).toBeInTheDocument();
});
