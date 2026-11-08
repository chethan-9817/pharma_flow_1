import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Server mode: real passwords, and data that lives on the server instead of in one browser. Every person
 * gets their own browser context. Contexts share nothing (no IndexedDB, no BroadcastChannel), so when they
 * stay in sync it is the server and its WebSocket doing it.
 */
const PASSWORD = 'pharmaflow';

async function resetServer(request: APIRequestContext) {
  const login = await request.post('/api/login', { data: { userId: 'u-admin', password: PASSWORD } });
  const { token } = (await login.json()) as { token: string };
  const res = await request.post('/api/reset', { headers: { Authorization: `Bearer ${token}` } });
  expect(res.ok()).toBe(true);
}

test.beforeEach(async ({ request }) => {
  await resetServer(request);
});

async function person(browser: Browser, path: string): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(path);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  return { page, context };
}

test.describe('server mode', () => {
  test('asks for a real password and refuses a wrong one', async ({ page }) => {
    await page.goto('/customer');
    await expect(page.getByRole('heading', { name: 'Customer login' })).toBeVisible();
    await expect(page.getByText('Demo password: pharmaflow')).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue as/ })).toHaveCount(0); // no 1-tap demo login here

    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Wrong user or password');

    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: /^Shop/ })).toBeVisible();
  });

  test('keeps nothing in the browser that the server should own', async ({ page }) => {
    await page.goto('/customer');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: /^Shop/ })).toBeVisible();

    const stored = await page.evaluate(async () => ({
      databases: (await indexedDB.databases()).map((d) => d.name),
      localKeys: Object.keys(localStorage),
      // The values only: the demo password happens to also be the app's name, which the keys contain.
      values: [...Object.values(localStorage), ...Object.values(sessionStorage)].join('|'),
    }));
    expect(stored.databases).not.toContain('pharmaflow'); // the event log is not in IndexedDB
    expect(stored.localKeys).toContain('pharmaflow-tokens');
    expect(stored.values).not.toContain(PASSWORD); // a token is kept, never the password
  });

  test('two separate browsers stay in sync through the server, and a sponsorship runs end to end', async ({ browser }) => {
    const chemist = await person(browser, '/chemist');
    const customer = await person(browser, '/customer');
    const rider = await person(browser, '/rider');

    // The chemist lists Okacet on Eco-Sale ...
    await chemist.page.getByRole('row').filter({ hasText: 'Okacet' }).getByRole('button', { name: 'Eco-Sale' }).click();
    await expect(chemist.page.getByText('Okacet is live in the Eco-Sale store')).toBeVisible();

    // ... and it shows up in the customer's other browser, with no refresh.
    await customer.page.getByRole('button', { name: /^Deals/ }).click();
    await expect(customer.page.getByRole('heading', { name: 'Okacet' })).toBeVisible();
    await customer.page.getByRole('button', { name: /Sponsor batch for NGO/ }).click();
    await customer.page.getByRole('button', { name: /Sponsor now/ }).click();
    await expect(customer.page.getByText(/A rider will collect the packs from the pharmacy/)).toBeVisible();

    // The rider's browser hears about the new mission and collects it at the store.
    await rider.page.getByRole('button', { name: 'Offline' }).click();
    await rider.page.getByRole('button', { name: 'Accept mission' }).click();
    await rider.page.getByRole('button', { name: 'Arrived', exact: true }).click();
    await rider.page.getByRole('button', { name: 'Collected', exact: true }).click();

    await expect(chemist.page.getByText('Sponsored', { exact: true }).first()).toBeVisible();
    await chemist.page.getByRole('button', { name: /QA verified, release to NGO/ }).click();
    await rider.page.getByRole('button', { name: /Hand over to Seva NGO Clinic/ }).click();
    await expect(rider.page.getByText('Delivered to NGO')).toBeVisible();

    await expect(chemist.page.locator('section', { hasText: 'Sponsored for NGOs' })).toContainText('₹92');
    await customer.page.getByRole('button', { name: /^Civic hub/ }).click();
    await expect(customer.page.getByText('Delivered to Seva NGO Clinic')).toBeVisible();

    // A reload keeps the person signed in for this tab, and the data comes back from the server.
    await customer.page.reload();
    await expect(customer.page.getByRole('button', { name: /^Civic hub/ })).toBeVisible();
    await customer.page.getByRole('button', { name: /^Civic hub/ }).click();
    await expect(customer.page.getByText('Delivered to Seva NGO Clinic')).toBeVisible();

    // Anyone can check the certificate's QR code, even with no login and no data of their own.
    const code = (await customer.page.getByText(/· code [A-Z0-9]{7}/).first().textContent())!.match(/code ([A-Z0-9]{7})/)![1]!;
    const stranger = await browser.newContext();
    const open = await stranger.newPage();
    await open.goto(`/verify?code=${code}`);
    await expect(open.getByRole('heading', { name: 'Certificate is valid' })).toBeVisible();
    await expect(open.getByText('Asha Shetty')).toBeVisible();
    await expect(open.getByText('This code was checked with the PharmaFlow server.')).toBeVisible();
    await open.goto('/verify?code=NOTREAL');
    await expect(open.getByRole('heading', { name: 'No certificate found' })).toBeVisible();

    await stranger.close();
    await Promise.all([chemist.context.close(), customer.context.close(), rider.context.close()]);
  });

  test('only the admin can move time or reset, from the top bar', async ({ browser }) => {
    const customer = await person(browser, '/customer');
    await expect(customer.page.getByRole('button', { name: /^Shop/ })).toBeVisible();

    // The top bar moves time as the admin. This browser has no admin login, so it is refused with a reason.
    await customer.page.getByRole('button', { name: '+1 week' }).click();
    await expect(customer.page.getByText('Sign in as the admin first')).toBeVisible();
    await expect(customer.page.getByText('Start of demo')).toBeVisible();

    // Once the admin signs in (in any tab of this browser), the same button works.
    const admin = await customer.context.newPage();
    await admin.goto('/admin');
    await admin.getByLabel('Password').fill(PASSWORD);
    await admin.getByRole('button', { name: 'Sign in' }).click();
    await expect(admin.getByRole('heading', { name: 'Admin & regulatory portal' })).toBeVisible();

    await customer.page.bringToFront();
    await customer.page.getByRole('button', { name: '+1 week' }).click();
    await expect(customer.page.getByText('Day +7')).toBeVisible();
    await customer.context.close();
  });
});
