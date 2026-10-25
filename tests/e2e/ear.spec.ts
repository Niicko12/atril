import { expect, test, type Page } from '@playwright/test';
import { CASES, SR } from '../fixtures/audio/synth.mjs';

/** WAV PCM mono generado en memoria: no hay grabaciones ajenas ni descargas. */
function wav(samples: Float32Array): Buffer {
  const out = Buffer.alloc(44 + samples.length * 2);
  out.write('RIFF');
  out.writeUInt32LE(out.length - 8, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return out;
}
async function loadAudio(page: Page, kind: 'escala' | 'mezcla' = 'escala') {
  await page.goto('/');
  await page.getByRole('button', { name: 'De oído', exact: true }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: `${kind}.wav`, mimeType: 'audio/wav', buffer: wav(CASES[kind].make()) });
  await expect(page.getByText(new RegExp(`${kind} ·`))).toBeVisible();
}
test('E2E-EAR-01/05: transcribe una escala sin enviar el audio a la red', async ({ page }) => {
  const violations: string[] = [];
  page.on('request', (request) => {
    if (request.postDataBuffer()) violations.push(`${request.method()} ${request.url()}`);
  });
  await loadAudio(page);
  await page.getByRole('button', { name: 'Escribir la melodía sola', exact: true }).click();
  await expect(page.getByText(/^Listo: 8 notas/)).toBeVisible();
  await expect(page.locator('#title')).toHaveValue('escala (de oído)');
  expect(violations).toEqual([]);
});
test('E2E-EAR-02: lista melodía/bajo y abre una parte con cifrados', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'El modo partes se verifica en Chromium.');
  await loadAudio(page, 'mezcla');
  await page.getByLabel('Tipo de audio').selectOption('parts');
  await page.getByRole('button', { name: 'Separar melodía, bajo y acordes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir Melodía', exact: true })).toBeVisible({ timeout: 110000 });
  await expect(page.getByRole('button', { name: 'Abrir Bajo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir Melodía', exact: true }).click();
  await expect(page.locator('#title')).toHaveValue('mezcla – Melodía');
});
test('E2E-EAR-04: cancelar la carga del modelo recupera los controles', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Prueba de carga del modelo.');
  await page.route('**/models/basic-pitch/model.json', () => {});
  await loadAudio(page);
  await page.getByLabel('Tipo de audio').selectOption('parts');
  await page.getByRole('button', { name: 'Separar melodía, bajo y acordes', exact: true }).click();
  await expect(page.getByText(/Preparando la inteligencia artificial/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Separar melodía, bajo y acordes', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Cancelar', exact: true })).toHaveCount(0);
});
test('E2E-EAR-06: el audio resalta la partitura y editar desactiva el seguimiento', async ({ page }) => {
  await loadAudio(page);
  await page.getByRole('button', { name: 'Escribir la melodía sola', exact: true }).click();
  await expect(page.getByText(/^Listo: 8 notas/)).toBeVisible();
  await page.getByRole('button', { name: 'Reproducir audio', exact: true }).click();
  await expect(page.locator('.play').first()).toBeVisible();
  await page.getByRole('button', { name: 'Pausar audio', exact: true }).click();
  await expect(page.locator('.play')).toHaveCount(0);
  await page.locator('#title').fill('Editada');
  await expect(page.getByText('La partitura cambió; el seguimiento del audio se desactivó.')).toBeVisible();
});
