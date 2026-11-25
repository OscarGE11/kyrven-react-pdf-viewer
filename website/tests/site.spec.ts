import { test, expect } from '@playwright/test';

test('renders the real WASM reader and supports code, local files and docs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('3 pages ready.', { exact: false })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Page', exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: 'Rotate right', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await expect(page.getByText('Reader.tsx', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Try it live' }).click();
  await page.locator('input[type=file]').setInputFiles('public/sample.pdf');
  await expect(page.locator('.document-caption')).toContainText('sample.pdf');
  await expect(page.getByText('3 pages ready.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Reset to sample PDF' }).click();
  await expect(page.locator('.document-caption')).toContainText('The Kyrven field guide.pdf');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(async () => page.locator('canvas').first().evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context || !canvas.width) return false;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 100 && pixels[i + 1] > 230 && pixels[i + 2] < 100 && pixels[i + 3] > 0) return true;
    }
    return false;
  })).toBe(true);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.goto('/docs/');
  await expect(page.getByRole('heading', { name: 'Quick start', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'API reference', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile pages stay inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/', '/docs/']) {
    await page.goto(route);
    if (route === '/') await expect(page.getByText('3 pages ready.', { exact: false })).toBeVisible({ timeout: 30000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: route === '/' ? 'test-results/mobile.png' : 'test-results/docs-mobile.png', fullPage: true });
  }
});
