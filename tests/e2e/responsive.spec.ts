import { expect, test, type Page } from '@playwright/test';

async function noPageOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1);
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 844, height: 390 },
]) {
  test(`editor y catálogo se ajustan a ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    // La comprobación de distribución no depende de la disponibilidad del catálogo externo.
    await page.route('https://api.github.com/**', (route) => route.abort());
    await page.goto('/');
    await expect(page.getByRole('img', { name: /^Partitura:/ })).toBeVisible();
    await page.getByLabel('Título', { exact: true }).fill('Título largo sin espacios '.repeat(5).slice(0, 120));
    await noPageOverflow(page);
    if (viewport.width >= 1280) {
      const main = await page.getByRole('main').boundingBox();
      const sheet = await page.getByRole('img', { name: /^Partitura:/ }).boundingBox();
      expect(main?.width).toBeGreaterThanOrEqual(viewport.width * 0.9);
      expect(sheet?.width).toBeGreaterThanOrEqual(viewport.width * 0.9);
    }
    const keyboard = page.getByRole('group', { name: 'Teclado de piano' });
    const pianoSize = await keyboard.boundingBox();
    expect(pianoSize).not.toBeNull();
    if (!pianoSize) throw new Error('No se pudo medir el piano');
    if (viewport.width >= 1280) {
      expect(pianoSize.width).toBeGreaterThanOrEqual(viewport.width * 0.9);
      const lastKey = await keyboard.getByRole('button', { name: 'Do6', exact: true }).boundingBox();
      if (!lastKey) throw new Error('No se pudo medir la última tecla');
      expect(Math.abs(lastKey.x + lastKey.width - (pianoSize.x + pianoSize.width))).toBeLessThanOrEqual(1);
    } else {
      const whiteKey = await keyboard.getByRole('button', { name: 'Do4', exact: true }).boundingBox();
      expect(whiteKey?.width).toBeGreaterThanOrEqual(39);
    }
    await page.getByRole('button', { name: 'Buscar o abrir', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Buscar o abrir', exact: true });
    await expect(dialog).toBeVisible();
    await noPageOverflow(page);
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error('No se pudo medir el diálogo');
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    await dialog.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const close = dialog.getByRole('button', { name: 'Cerrar', exact: true });
    await expect(close).toBeInViewport();
    await close.click();
    await expect(dialog).toHaveCount(0);
  });
}

test('el dock permite acceder al diapasón y al editor en horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Diapasón', exact: true }).click();
  const dock = page.locator('div[class*="_dock_"]');
  const bounds = await dock.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error('No se pudo medir el dock');
  expect(bounds.height).toBeLessThanOrEqual(390 * 0.6 + 1);
  expect(bounds.y).toBeGreaterThan(0);
  await dock.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(dock.locator('[data-midi]').last()).toBeAttached();
  await dock.locator('[data-midi]').first().click();
  await noPageOverflow(page);
});
