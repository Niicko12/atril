// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Overlay } from './overlay';

function Host() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir diálogo</button>
      <button>Fondo</button>
      {open && (
        <Overlay title="Prueba de foco" closeLabel="Cerrar" onClose={() => setOpen(false)}>
          <input aria-label="Nombre" />
          <button disabled>No disponible</button>
          <details>
            <summary>Más opciones</summary>
            <a href="#opcion">Enlace plegado</a>
          </details>
          <button>Confirmar</button>
        </Overlay>
      )}
    </>
  );
}
it('atrapa Tab/Mayús+Tab, excluye controles plegados y restaura foco/scroll con Escape', async () => {
  const user = userEvent.setup();
  document.body.style.overflow = 'auto';
  render(<Host />);
  const opener = screen.getByRole('button', { name: 'Abrir diálogo' });
  await user.click(opener);
  const close = screen.getByRole('button', { name: 'Cerrar' });
  expect(close).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  await user.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.tab();
  expect(screen.getByLabelText('Nombre')).toHaveFocus();
  await user.tab();
  expect(screen.getByText('Más opciones')).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  expect(document.body.style.overflow).toBe('auto');
});
it('recupera el foco si salió del diálogo y no cierra al pulsar el contenido', () => {
  render(<Host />);
  fireEvent.click(screen.getByText('Abrir diálogo'));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(dialog);
  expect(dialog).toBeInTheDocument();
  screen.getByText('Fondo').focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByText('Cerrar')).toHaveFocus();
  fireEvent.click(dialog.parentElement!);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
