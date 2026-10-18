import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/work-sans/400.css';
import '@fontsource/work-sans/500.css';
import '@fontsource/work-sans/600.css';
import '@fontsource/bodoni-moda/latin-700-italic.css';
import './app/theme.css';
import { AppShell } from './app/app-shell';
import { bootLibrary } from './modules/library';

const root = document.getElementById('root');
const BOOT_TIMEOUT_MS = 1500;

// Abre la última partitura antes del primer render (library-spec 7.1); si tarda, se dibuja igual.
void Promise.race([bootLibrary(), new Promise((r) => setTimeout(r, BOOT_TIMEOUT_MS))]).finally(() => {
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <AppShell />
      </StrictMode>,
    );
  }
});
