import type { BrowserContext, Page } from '@playwright/test';

export const PEOPLE = {
  customer: { path: '/customer', name: 'Asha Shetty' },
  chemist: { path: '/chemist', name: 'Ganesh Prabhu' },
  rider: { path: '/rider', name: 'Kiran Poojary' },
  admin: { path: '/admin', name: 'PharmaFlow Admin' },
} as const;

export type RoleName = keyof typeof PEOPLE;
export type Tabs = Record<RoleName, Page>;

/**
 * Opens the four roles as four tabs of one browser, each signed in with the 1-tap demo login.
 * Tabs share the event log through IndexedDB and BroadcastChannel, exactly like the live demo.
 */
export async function openAllRoles(context: BrowserContext): Promise<Tabs> {
  const tabs = {} as Tabs;
  for (const role of Object.keys(PEOPLE) as RoleName[]) {
    const page = await context.newPage();
    await page.goto(PEOPLE[role].path);
    await page.getByRole('button', { name: `Continue as ${PEOPLE[role].name}` }).click();
    tabs[role] = page;
  }
  return tabs;
}

/**
 * Brings a tab to the front before it is used. Browsers pause animations in background tabs, so a click
 * could otherwise wait for an animation that never finishes.
 */
export async function front(page: Page): Promise<Page> {
  await page.bringToFront();
  return page;
}
