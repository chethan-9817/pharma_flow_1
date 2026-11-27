import { expect, test } from '@playwright/test';

test('pharmacies pool an order, agents trade offers, and the admin awards the recommended deal', async ({ context }) => {
  async function signIn(role: string, name: string) {
    const page = await context.newPage();
    await page.goto(`/${role}`);
    await page.getByRole('button', { name: `Continue as ${name}` }).click();
    return page;
  }

  const customer = await signIn('customer', 'Asha Shetty');
  await customer.getByRole('button', { name: 'Medicine returns', exact: true }).click();
  await expect(customer.getByRole('heading', { name: 'Donate unused medicines' })).toBeVisible();
  await expect(customer.getByRole('heading', { name: 'Donate blood' })).toHaveCount(0);

  const firstStore = await signIn('chemist', 'Ganesh Prabhu');
  await firstStore.getByRole('button', { name: 'Request bulk stock' }).click();
  await expect(firstStore.getByText('Your store is in this pool.', { exact: false })).toBeVisible();
  const secondStore = await signIn('chemist', 'Suresh Kamath');
  await secondStore.getByRole('button', { name: 'Join the pool' }).click();
  await expect(secondStore.getByText('Your store is in this pool.', { exact: false })).toBeVisible();

  const admin = await signIn('admin', 'PharmaFlow Admin');
  await expect(admin.getByRole('button', { name: 'Verify ledger integrity' })).toBeVisible();
  await expect(admin.getByRole('heading', { name: 'Blood donation bookings' })).toHaveCount(0);
  await admin.getByRole('tab', { name: /^Bulk orders/ }).click();
  await admin.getByRole('button', { name: 'Ask dealers for quotes' }).click();
  await expect(admin.getByText('Quotes received: 0')).toBeVisible();

  const dealer = await signIn('dealer', 'Ramesh Hegde');
  await dealer.getByLabel('Your price per pack (₹)').fill('50');
  await dealer.getByLabel('Lowest price you accept (₹)').fill('42');
  await dealer.getByRole('button', { name: 'Send quote' }).click();
  await expect(dealer.getByText('Waiting for the admin to start the negotiation.')).toBeVisible();

  await admin.bringToFront();
  await admin.getByRole('button', { name: 'Start agent negotiation' }).click();
  await expect(admin.getByText('Recommended', { exact: true })).toBeVisible();
  await expect(admin.getByText('Agreed at ₹42 a pack')).toBeVisible();
  await admin.getByText('Agent conversation', { exact: true }).click();
  await expect(admin.getByText('PharmaFlow agent', { exact: true }).first()).toBeVisible();
  await expect(admin.getByText('Dealer agent', { exact: true }).first()).toBeVisible();
  await expect(admin.getByText('I can offer ₹50 per pack.', { exact: true })).toBeVisible();
  await expect(admin.getByText('We can agree at ₹42 per pack.', { exact: true })).toBeVisible();

  await admin.getByRole('button', { name: 'Award', exact: true }).click();
  await expect(admin.getByText('Waiting for Coastal Pharma Distributors to deliver.')).toBeVisible();
  await dealer.bringToFront();
  await expect(dealer.getByText('You won this order at ₹42 a pack.')).toBeVisible();
  await dealer.getByText('Agent conversation', { exact: true }).click();
  await expect(dealer.getByText('We can agree at ₹42 per pack.', { exact: true })).toBeVisible();
});
