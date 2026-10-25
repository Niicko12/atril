import { expect, test, type Page } from '@playwright/test';
import { unzipSync, strFromU8 } from 'fflate';

async function freshScore(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('img', { name: /^Partitura:/ })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva', exact: true }).click();
  await page.getByRole('button', { name: '¿Empezar de cero?', exact: true }).click();
  await expect(page.getByText('0 notas · 0 compases', { exact: true })).toBeVisible();
}
async function addDo(page: Page) {
  await page.locator('[data-midi="60"]').click();
}

test('edición, deshacer/rehacer y guardado sobreviven a la recarga', async ({ page }) => {
  await freshScore(page);
  await page.getByLabel('Título', { exact: true }).fill('Prueba persistente');
  await addDo(page);
  await page.getByRole('button', { name: 'Silencio', exact: true }).click();
  await expect(page.getByText(/^2 notas ·/)).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(page.getByText(/^1 notas ·/)).toBeVisible();
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await expect(page.getByText(/^2 notas ·/)).toBeVisible();
  await expect(page.getByText('✓ Guardada en este dispositivo', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Prueba persistente');
  await expect(page.getByText(/^2 notas ·/)).toBeVisible();
  await expect(page.getByRole('img', { name: /Partitura: Prueba persistente/ })).toBeVisible();
});

test('una partitura puede ir a papelera y recuperarse', async ({ page }) => {
  await freshScore(page);
  await page.getByLabel('Título', { exact: true }).fill('Recuperable');
  await addDo(page);
  await expect(page.getByText('✓ Guardada en este dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mis partituras', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Mis partituras' });
  await dialog.getByRole('button', { name: 'Mover a la papelera: Recuperable', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Papelera', exact: true }).click();
  const row = dialog.getByRole('listitem').filter({ has: page.getByText('Recuperable', { exact: true }) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(dialog.getByText('La papelera está vacía.', { exact: true })).toBeVisible();
  await dialog.getByRole('tab', { name: 'Partituras', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Duplicar Recuperable', exact: true })).toBeVisible();
});

test('exporta un ZIP real con MusicXML, MIDI y ABC', async ({ page }) => {
  await freshScore(page);
  await page.getByLabel('Título', { exact: true }).fill('Exportación de prueba');
  await addDo(page);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar para MuseScore', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const stream = await download.createReadStream();
  if (!stream) throw new Error('No se recibió el archivo exportado');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const files = unzipSync(Buffer.concat(chunks));
  const xml = Object.keys(files).find((name) => name.endsWith('.musicxml'));
  const midi = Object.keys(files).find((name) => name.endsWith('.mid'));
  const abc = Object.keys(files).find((name) => name.endsWith('.abc'));
  if (!xml || !midi || !abc) throw new Error('Faltan formatos en el ZIP');
  const xmlData = files[xml],
    midiData = files[midi],
    abcData = files[abc];
  if (!xmlData || !midiData || !abcData) throw new Error('Faltan datos en el ZIP');
  expect(strFromU8(xmlData)).toContain('<step>C</step>');
  expect(strFromU8(midiData.slice(0, 4))).toBe('MThd');
  expect(strFromU8(abcData)).toContain('Exportación de prueba');
});

test('Ayuda mantiene el foco y devuelve el control al editor', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Ayuda', exact: true });
  await opener.focus();
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Ayuda y acerca de Atril' });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Cerrar', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
