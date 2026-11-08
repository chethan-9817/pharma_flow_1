import { expect, test, type Page } from '@playwright/test';
import { front, openAllRoles } from './roles';

/** The chemist puts the Okacet batch on Eco-Sale (60% off, ₹9.20 a pack, so ₹99 sponsors 10 packs). */
async function listOkacet(chemist: Page) {
  await front(chemist);
  await chemist.getByRole('row').filter({ hasText: 'Okacet' }).getByRole('button', { name: 'Eco-Sale' }).click();
  await expect(chemist.getByText('Okacet is live in the Eco-Sale store')).toBeVisible();
}

async function sponsor(customer: Page) {
  await front(customer);
  await customer.getByRole('button', { name: /^Deals/ }).click();
  await customer.getByRole('button', { name: /Sponsor batch for NGO/ }).click();
  await expect(customer.getByText(/sponsors\s*10\s*packs for Seva NGO Clinic/)).toBeVisible();
  await customer.getByRole('button', { name: /Sponsor now/ }).click();
  await expect(customer.getByText(/A rider will collect the packs from the pharmacy/)).toBeVisible();
}

async function riderCollects(rider: Page) {
  await front(rider);
  await rider.getByRole('button', { name: 'Offline' }).click();
  await rider.getByRole('button', { name: 'Accept mission' }).click();
  await rider.getByRole('button', { name: 'Arrived', exact: true }).click();
  await rider.getByRole('button', { name: 'Collected', exact: true }).click();
}

test.describe('Sponsor batch for NGO, across four tabs', () => {
  test('the store supplies the packs, is paid, the NGO fund grows and the sponsor is rewarded', async ({ context }) => {
    const { customer, chemist, rider, admin } = await openAllRoles(context);

    await listOkacet(chemist);
    await sponsor(customer);

    // The pickup starts at the store, so it shows up on the rider's radar and then the chemist's QA desk.
    await riderCollects(rider);
    await front(chemist);
    await expect(chemist.getByText('Sponsored', { exact: true }).first()).toBeVisible();
    await expect(chemist.getByText(/You are paid ₹92 once the NGO has them/)).toBeVisible();
    await chemist.getByRole('button', { name: /QA verified, release to NGO/ }).click();

    await front(rider);
    await rider.getByRole('button', { name: /Hand over to Seva NGO Clinic/ }).click();
    await expect(rider.getByText('Delivered to NGO')).toBeVisible();

    // The store is paid the Eco-Sale price for the packs.
    await front(chemist);
    const sponsored = chemist.locator('section', { hasText: 'Sponsored for NGOs' });
    await expect(sponsored.getByText('Paid', { exact: true }).last()).toBeVisible(); // the badge on the sponsorship card
    await expect(sponsored).toContainText('₹92');
    await expect(sponsored).toContainText('Okacet ×10 for Seva NGO Clinic');

    // The sponsor earns +200 karma and an NGO Donor certificate that names the sponsorship.
    await front(customer);
    await expect(customer.getByText('200', { exact: true })).toBeVisible();
    await customer.getByRole('button', { name: /^Civic hub/ }).click();
    await expect(customer.getByText('Delivered to Seva NGO Clinic')).toBeVisible();
    await expect(customer.getByText(/Sponsored 10 packs of Okacet for Seva NGO Clinic/)).toBeVisible();

    // The change from the sponsor's ₹99 tops up the NGO fund, and the admin sees it.
    await front(admin);
    const fund = admin.locator('section').filter({ has: admin.getByRole('heading', { name: 'NGO fund', exact: true }) });
    await expect(fund).toContainText('₹7');
    await expect(fund).toContainText('10 packs sponsored and delivered');
    await admin.getByRole('button', { name: /Verify ledger integrity/ }).click();
    await expect(admin.getByText(/Chain intact: \d+ events verified/)).toBeVisible();
  });

  test('a failed pharmacist check refunds the sponsor as MedWallet credit', async ({ context }) => {
    const { customer, chemist, rider } = await openAllRoles(context);

    await listOkacet(chemist);
    await sponsor(customer);
    await riderCollects(rider);

    await front(chemist);
    chemist.once('dialog', (d) => void d.accept('Seal broken'));
    await chemist.getByRole('button', { name: /Reject, send to bio-disposal/ }).click();
    await expect(chemist.getByText('Rejected. A rider will take it to the CBWTF')).toBeVisible();

    await front(rider);
    await rider.getByRole('button', { name: /QA rejected: take to CBWTF/ }).click();

    await front(customer);
    await customer.getByRole('button', { name: /^Civic hub/ }).click();
    await expect(customer.getByText(/₹99 is back in your MedWallet/)).toBeVisible();
    await expect(customer.getByText('₹99', { exact: true }).first()).toBeVisible();
  });

  test('prescription-only deals cannot be sponsored', async ({ context }) => {
    const { customer, chemist } = await openAllRoles(context);

    // Put the Augmentin batch (prescription-only) on Eco-Sale.
    await front(chemist);
    await chemist.getByRole('row').filter({ hasText: 'Augmentin' }).getByRole('button', { name: 'Eco-Sale' }).click();

    await front(customer);
    await customer.getByRole('button', { name: /^Deals/ }).click();
    await customer.getByRole('button', { name: /Sponsor batch for NGO/ }).click();
    await expect(customer.getByRole('alert')).toContainText('only over-the-counter medicines can be sponsored');
    await expect(customer.getByRole('button', { name: /Sponsor now/ })).toHaveCount(0);
  });
});
