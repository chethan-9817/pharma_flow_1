import { expect, test } from '@playwright/test';

for (const width of [375, 1280]) {
  test('shop search recovers from an empty result at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/customer');
    await page.getByRole('button', { name: 'Continue as Asha Shetty' }).click();
    const search = page.getByRole('searchbox', { name: 'Search medicines, salts or products' });
    await page.getByRole('button', { name: /^Skin care/ }).click();
    await search.fill('zzzz-no-such-product');
    await expect(page.getByRole('status')).toContainText('No products found');
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('heading', { name: 'Dolo 650', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^All \d/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('link', { name: 'Customer', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset demo', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Browse Eco-Sale', exact: true }).click();
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Deals', exact: true })).toHaveAttribute('aria-current', 'page');
  });
}
