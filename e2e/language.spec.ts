import { expect, test } from '@playwright/test';
import { openAllRoles } from './roles';

/** The language picker in the top bar. Fresh browser contexts start in English. */
test.describe('English, Kannada and Hindi', () => {
  test('the customer app switches language, and the choice survives a reload', async ({ page }) => {
    await page.goto('/customer');
    await page.getByRole('button', { name: 'Continue as Asha Shetty' }).click();
    await expect(page.getByRole('button', { name: /^Shop/ })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    const picker = page.locator('header select');
    await picker.selectOption('kn');
    await expect(page.locator('html')).toHaveAttribute('lang', 'kn');
    await expect(page.getByRole('button', { name: /^ಅಂಗಡಿ/ })).toBeVisible();
    await expect(page.getByText('ನಮಸ್ಕಾರ,')).toBeVisible();
    await expect(page.getByPlaceholder('ಔಷಧಿ ಅಥವಾ ಲವಣಗಳನ್ನು ಹುಡುಕಿ')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Shop/ })).toHaveCount(0);

    await picker.selectOption('hi');
    await expect(page.getByRole('button', { name: /^दुकान/ })).toBeVisible();
    await expect(page.getByText('नमस्ते,')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ऑफ़र' })).toBeVisible();

    // The medicine catalogue itself is data, so it is not translated.
    await expect(page.getByRole('heading', { name: 'Dolo 650' })).toBeVisible();

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.getByRole('button', { name: /^दुकान/ })).toBeVisible();

    await page.locator('header select').selectOption('en');
    await expect(page.getByRole('button', { name: /^Shop/ })).toBeVisible();
  });

  test('a sponsorship reads naturally in Kannada, with the real numbers', async ({ context }) => {
    const { customer, chemist } = await openAllRoles(context);
    await chemist.bringToFront();
    await chemist.getByRole('row').filter({ hasText: 'Okacet' }).getByRole('button', { name: 'Eco-Sale' }).click();

    await customer.bringToFront();
    await customer.locator('header select').selectOption('kn');
    await customer.getByRole('button', { name: /^ಆಫರ್‌ಗಳು/ }).click();
    await customer.getByRole('button', { name: /ಎನ್‌ಜಿಒಗಾಗಿ ಬ್ಯಾಚ್ ಪ್ರಾಯೋಜಿಸಿ/ }).click();
    // The same plan as in English: 10 packs for ₹99, ₹92 to the store, ₹7 to the fund.
    await expect(customer.getByText(/₹99.*Seva NGO Clinic.*10.*ಪ್ಯಾಕ್/)).toBeVisible();
    await expect(customer.getByText(/₹92.*Sri Ganesh Medicals/)).toBeVisible();
    await expect(customer.getByText(/₹7.*ಎನ್‌ಜಿಒ ನಿಧಿ/)).toBeVisible();
  });

  test('the All 4 panes follow the language picked in the top bar', async ({ page }) => {
    await page.goto('/presenter');
    const customerPane = page.frameLocator('iframe[title="Customer"]');
    await expect(customerPane.getByRole('button', { name: 'Continue as Asha Shetty' })).toBeVisible();

    await page.locator('header select').selectOption('hi');
    await expect(customerPane.getByRole('button', { name: 'Asha Shetty के रूप में जारी रखें' })).toBeVisible();
    await expect(page.frameLocator('iframe[title="Admin"]').getByText('एडमिन डेमो लॉगिन')).toBeVisible();

    await page.locator('header select').selectOption('en');
    await expect(customerPane.getByRole('button', { name: 'Continue as Asha Shetty' })).toBeVisible();
  });
});
