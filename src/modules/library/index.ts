/** Carga diferida del overlay (fuera del JS inicial). */
export const loadLibraryOverlay = () =>
  import('./components/library-overlay').then((m) => ({ default: m.LibraryOverlay }));
export { SaveBadge } from './components/save-badge';
export { InstallHint } from './components/install-hint';
export { useTabGuard } from './hooks/use-tab-guard';
export { bootLibrary, prepareReplace, startAutosave, flushSave } from './services/autosave.service';
export { scoreRepository } from './services/score-repository';
export { prefs } from './services/prefs.service';
export { S as libraryStrings } from './strings';
export type { SaveState, BackupReport } from './types';
