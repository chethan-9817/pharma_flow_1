import { expect, test } from '@playwright/test';
import { front, openAllRoles } from './roles';

/**
 * The README demo walkthrough, run across four tabs. Nothing is refreshed: every tab learns about
 * the others' actions through the shared event log.
 */
test.describe('demo walkthrough across four tabs', () => {
  test('Eco-Sale to delivery with OTP, a scratch card and an intact ledger', async ({ context }) => {
    const { customer, chemist, rider, admin } = await openAllRoles(context);

    // Chemist puts the Okacet batch on Eco-Sale ...
    await front(chemist);
    await chemist.getByRole('row').filter({ hasText: 'Okacet' }).getByRole('button', { name: 'Eco-Sale' }).click();
    await expect(chemist.getByText('Okacet is live in the Eco-Sale store')).toBeVisible();

    // ... and it appears in the customer's Deals tab without a refresh.
    await front(customer);
    await customer.getByRole('button', { name: /^Deals/ }).click();
    await expect(customer.getByRole('heading', { name: 'Okacet' })).toBeVisible();
    await expect(customer.getByText('60% OFF')).toBeVisible();
    await customer.getByRole('button', { name: /Buy for myself/ }).click();
    await customer.getByRole('button', { name: /^Cart/ }).click();
    await customer.getByRole('button', { name: 'Place order' }).click();
    await expect(customer.getByText(/Order placed. Delivery OTP \d{4}/)).toBeVisible();
    const otp = (await customer.getByText(/^OTP \d{4}$/).first().textContent())!.replace('OTP ', '');

    // Chemist packs it; the rider takes it from the radar.
    await front(chemist);
    await chemist.getByRole('button', { name: /Pack & summon rider/ }).click();
    await front(rider);
    await rider.getByRole('button', { name: 'Offline' }).click();
    await rider.getByRole('button', { name: 'Accept mission' }).click();
    await rider.getByRole('button', { name: 'Arrived at store' }).click();
    await rider.getByRole('button', { name: 'Collected, start delivery' }).click();
    await rider.getByPlaceholder('Customer OTP').fill(otp);
    await rider.getByRole('button', { name: 'Confirm handover' }).click();
    await expect(rider.getByText('Delivered!')).toBeVisible();

    // The customer gets a scratch card and sees where part of the order went.
    await front(customer);
    await customer.getByRole('button', { name: /^Orders/ }).click();
    await expect(customer.getByText('Scratch cards')).toBeVisible();
    await expect(customer.getByText(/from this order went into the NGO fund/)).toBeVisible();

    // Admin: the KPIs moved and the ledger is intact.
    await front(admin);
    await expect(admin.getByText('Dead stock recovered').locator('xpath=following-sibling::span[1]')).not.toHaveText('₹0');
    await admin.getByRole('button', { name: /Verify ledger integrity/ }).click();
    await expect(admin.getByText(/Chain intact: \d+ events verified/)).toBeVisible();
  });

  test('a prescription drug needs the chemist to approve the prescription before packing', async ({ context }) => {
    const { customer, chemist } = await openAllRoles(context);

    await front(customer);
    await customer.getByPlaceholder('Search medicines or salts').fill('Augmentin');
    await customer.getByRole('button', { name: 'Add' }).click();
    await customer.getByRole('button', { name: /^Cart/ }).click();
    await expect(customer.getByText('Prescription required')).toBeVisible();
    await customer.getByPlaceholder('Dr. Meera Rao').fill('Dr. Meera Rao');
    await customer.getByPlaceholder('KMC-48213').fill('KMC-48213');
    await customer.getByRole('button', { name: 'Place order and send prescription' }).click();
    await expect(customer.getByText(/pharmacist will review your prescription/)).toBeVisible();

    await front(chemist);
    await expect(chemist.getByText('Rx to review')).toBeVisible();
    await expect(chemist.getByRole('button', { name: /Pack & summon rider/ })).toHaveCount(0);
    await chemist.getByRole('button', { name: /Approve Rx/ }).click();
    await expect(chemist.getByRole('button', { name: /Pack & summon rider/ })).toBeVisible();
  });
});
