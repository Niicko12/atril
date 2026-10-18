import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './app/app-shell';
import './app/theme.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AppShell />
    </StrictMode>,
  );
}
