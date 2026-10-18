import { prefs } from './prefs.service';

const DAY_MS = 86400000;

/** Pide almacenamiento persistente una sola vez (library-spec 13.1). */
export async function askPersistOnce(): Promise<void> {
  if (await prefs.get('persistAsked')) return;
  const granted = (await navigator.storage?.persist?.().catch(() => false)) ?? false;
  await prefs.set('persistAsked', true);
  await prefs.set('persistGranted', granted);
}

export interface Platform {
  ios: boolean;
  standalone: boolean;
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    matchMedia?.('(display-mode: standalone)').matches === true;
  return { ios, standalone };
}

/** ¿Mostrar la sugerencia de pantalla de inicio? (library-spec 13.2) */
export interface InstallHintInput {
  platform: Platform;
  hasScores: boolean;
  shownAt: string | null;
  dismissed: boolean;
}

export function shouldShowInstallHint(
  { platform, hasScores, shownAt, dismissed }: InstallHintInput,
  now = Date.now(),
): boolean {
  if (!platform.ios || platform.standalone || !hasScores || dismissed) return false;
  return shownAt === null || now - Date.parse(shownAt) > 30 * DAY_MS;
}

/** ¿Recordar hacer copia? (library-spec 13.4) */
export function shouldRemindBackup(
  lastBackupAt: string | null,
  latestUpdate: string | null,
  now = Date.now(),
): boolean {
  if (!latestUpdate) return false;
  if (!lastBackupAt) return true;
  return now - Date.parse(lastBackupAt) > 14 * DAY_MS && latestUpdate > lastBackupAt;
}

export async function storageUsage(): Promise<{ usage: number; quota: number } | null> {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  return est && est.usage != null && est.quota ? { usage: est.usage, quota: est.quota } : null;
}
