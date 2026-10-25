import { expect, test } from '@playwright/test';

for (const width of [320, 1440, 2560]) {
  test(`borrador visual y ancho disponible a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('img', { name: /^Partitura:/ })).toBeVisible();
    await page.getByRole('button', { name: 'Editor visual', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Editor visual de notas' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Altura MIDI (sonido real)', { exact: true })).toHaveValue('64');
    await dialog.getByLabel('Altura MIDI (sonido real)', { exact: true }).fill('72');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Editor visual', exact: true }).click();
    await expect(dialog.getByLabel('Altura MIDI (sonido real)', { exact: true })).toHaveValue('64');
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error('No se pudo medir el editor visual');
    expect(box.width).toBeGreaterThan(width * 0.8);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1);
    await dialog.getByLabel('Altura MIDI (sonido real)', { exact: true }).fill('72');
    await dialog.getByRole('button', { name: 'Aplicar cambios', exact: true }).click();
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await page.getByRole('button', { name: 'Editor visual', exact: true }).click();
    await expect(dialog.getByLabel('Altura MIDI (sonido real)', { exact: true })).toHaveValue('64');
  });
}
