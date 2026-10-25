/** Ayuda diferida: no añade sus textos ni diagnóstico al JavaScript inicial. */
export const loadHelpOverlay = () => import('./components/help-overlay').then((m) => ({ default: m.HelpOverlay }));
