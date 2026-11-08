import { expect, test } from '@playwright/test';

/**
 * Runs against the production build (`npm run test:e2e:pwa`), because the service worker is only built
 * by `vite build`. It checks that Chrome sees an installable app and that the shell loads offline.
 */
test.describe('installable app with an offline shell', () => {
  test('has a valid manifest that Chrome accepts as installable', async ({ page, context }) => {
    await page.goto('/presenter');
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);

    const manifest = await page.evaluate(async () => {
      const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href;
      return (await fetch(href)).json();
    });
    expect(manifest).toMatchObject({ name: 'PharmaFlow', short_name: 'PharmaFlow', display: 'standalone', start_url: '/presenter', theme_color: '#0284C7' });
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);

    for (const icon of manifest.icons as { src: string }[]) {
      const res = await page.request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
    }

    await page.evaluate(() => navigator.serviceWorker.ready);
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: { errorId: string }[] };
    // Playwright's browser contexts are incognito-like, and Chrome never offers installation there.
    // That is the only reason allowed: every manifest, icon and service worker requirement must pass.
    expect(installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito')).toEqual([]);
  });

  test('loads the app, and keeps the data, with no network', async ({ page, context }) => {
    await page.goto('/customer');
    await page.evaluate(() => navigator.serviceWorker.ready);
    // The first load installs the worker; a reload makes sure it is the one answering requests.
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.getByRole('button', { name: 'Continue as Asha Shetty' }).click();
    await expect(page.getByRole('button', { name: /^Shop/ })).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    // Still signed in (sessionStorage) and the shop still lists medicines (IndexedDB), with the network off.
    await expect(page.getByRole('button', { name: /^Shop/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dolo 650' })).toBeVisible();

    // A page the app never visited online still opens, because every route is the same single-page app.
    await page.goto('/verify?code=ABC');
    await expect(page.getByText(/certificate/i).first()).toBeVisible();
    await context.setOffline(false);
  });
});
