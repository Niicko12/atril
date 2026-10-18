// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { emptyScore } from '@/core';
import { resetDbForTests } from '@/infra/idb';
import { useScoreStore } from '@/modules/editor';
import { useSaveStore } from '../store/save.store';
import { prefs } from '../services/prefs.service';
import { scoreRepository } from '../services/score-repository';
import { LibraryOverlay } from './library-overlay';
import { SaveBadge } from './save-badge';
import { formatDate } from './score-row';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  prefs.resetForTests();
  useSaveStore.setState({ state: { kind: 'unsaved' }, memoryOnly: false });
});

describe('formatDate (T-UI-02)', () => {
  const now = new Date(2026, 9, 18, 15, 0);
  it('hoy con hora; este año sin año; otro año con año', () => {
    expect(formatDate(new Date(2026, 9, 18, 14, 5).toISOString(), now)).toMatch(/^hoy, 14:05$/);
    expect(formatDate(new Date(2026, 9, 3).toISOString(), now)).toMatch(/^3 oct$/);
    expect(formatDate(new Date(2025, 9, 18).toISOString(), now)).toMatch(/^18 oct 2025$/);
  });
});

describe('SaveBadge (T-UI-07/08)', () => {
  it.each([
    [{ kind: 'unsaved' }, 'Sin guardar (aún no la editaste)'],
    [{ kind: 'saving' }, 'Guardando…'],
    [{ kind: 'saved', at: 'x' }, '✓ Guardada en este dispositivo'],
    [{ kind: 'error', message: 'Sin espacio' }, 'Sin espacio'],
  ] as const)('%o', (state, text) => {
    useSaveStore.setState({ state: state as never });
    render(<SaveBadge />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
  it('modo memoria muestra el aviso persistente', () => {
    useSaveStore.setState({ memoryOnly: true });
    render(<SaveBadge />);
    expect(screen.getByRole('alert')).toHaveTextContent('no se guardan');
  });
});

describe('LibraryOverlay (T-UI-01/03/04)', () => {
  it('lista vacía, ejemplos y abrir una partitura guardada', async () => {
    const onClose = vi.fn();
    const { unmount } = render(<LibraryOverlay onClose={onClose} />);
    expect(await screen.findByText(/Aún no tienes partituras guardadas/)).toBeInTheDocument();
    expect(screen.getByText('Himno de la alegría')).toBeInTheDocument();
    unmount();
    const s = { ...emptyScore('flauta'), title: 'Guardada', notes: [{ p: 72, d: 4 }] };
    await scoreRepository.save(s);
    render(<LibraryOverlay onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir Guardada' }));
    await waitFor(() => expect(useScoreStore.getState().score.title).toBe('Guardada'));
    expect(onClose).toHaveBeenCalled();
  });
  it('"Abrir" deshabilitado en la abierta; mover a la papelera y verla allí', async () => {
    const s = { ...emptyScore('piano'), title: 'Actual' };
    await scoreRepository.save(s);
    act(() => useScoreStore.getState().replaceScore(s));
    render(<LibraryOverlay onClose={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Abrir Actual' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Mover a la papelera: Actual' }));
    await waitFor(async () => expect(await scoreRepository.listTrash()).toHaveLength(1));
    fireEvent.click(screen.getByRole('tab', { name: 'Papelera' }));
    expect(await screen.findByText(/Se borrará en 30 días/)).toBeInTheDocument();
  });
  it('Escape cierra el overlay', () => {
    const onClose = vi.fn();
    render(<LibraryOverlay onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
