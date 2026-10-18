// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { emptyScore } from '@/core';
import * as download from '@/infra/download';
import { resetDbForTests } from '@/infra/idb';
import { useScoreStore } from '@/modules/editor';
import { useSaveStore } from '../store/save.store';
import { prefs } from '../services/prefs.service';
import { scoreRepository } from '../services/score-repository';
import { BackupPanel } from './backup-panel';
import { InstallHint } from './install-hint';
import { useTabGuard } from '../hooks/use-tab-guard';
import * as persistence from '../services/persistence';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  prefs.resetForTests();
  vi.restoreAllMocks();
});

describe('BackupPanel', () => {
  it('hacer copia descarga el ZIP y recuerda la fecha; sin copia previa avisa', async () => {
    await scoreRepository.save({ ...emptyScore('piano'), title: 'Uno' });
    const save = vi.spyOn(download, 'saveBlob').mockImplementation(() => {});
    render(<BackupPanel latestUpdate="2026-10-01T00:00:00Z" />);
    expect(await screen.findByText(/Todavía no hiciste una copia de respaldo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hacer copia' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.stringMatching(/^atril-respaldo-\d{4}-\d{2}-\d{2}\.zip$/),
        expect.any(Blob),
      ),
    );
    expect(await screen.findByText('Copia lista: 1 partituras.')).toBeInTheDocument();
    expect(await prefs.get('lastBackupCount')).toBe(1);
  });
  it('restaurar un archivo ajeno muestra el error', async () => {
    render(<BackupPanel latestUpdate={null} />);
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    const file = new File(['{"format":"otro"}'], 'x.json', { type: 'application/json' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new TextEncoder().encode('{"format":"otro"}').buffer,
    });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('Ese archivo no es una copia de Atril.')).toBeInTheDocument();
  });
  it('Borrar todo pide confirmación con un segundo toque', () => {
    render(<BackupPanel latestUpdate={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar todo' }));
    expect(screen.getByRole('button', { name: /No se puede deshacer/ })).toBeInTheDocument();
  });
});

describe('InstallHint', () => {
  it('aparece tras guardar en un iPhone y "Entendido" no la vuelve a mostrar', async () => {
    vi.spyOn(persistence, 'detectPlatform').mockReturnValue({ ios: true, standalone: false });
    useSaveStore.setState({ state: { kind: 'saved', at: 'x' } });
    render(<InstallHint />);
    fireEvent.click(await screen.findByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('note')).toBeNull();
    expect(await prefs.get('installHintDismissed')).toBe(true);
  });
});

describe('useTabGuard (T-TAB-01)', () => {
  it('avisa si otra pestaña abre la misma partitura', async () => {
    const s = emptyScore('piano');
    act(() => useScoreStore.getState().replaceScore(s));
    const { result } = renderHook(() => useTabGuard());
    const other = new BroadcastChannel('atril');
    other.postMessage({ type: 'open', tab: 'otra', id: s.id });
    await waitFor(() => expect(result.current.otherTabOpen).toBe(true));
    other.postMessage({ type: 'saved', tab: 'otra', id: s.id });
    await waitFor(() => expect(result.current.otherTabSaved).toBe(true));
    other.close();
  });
});
