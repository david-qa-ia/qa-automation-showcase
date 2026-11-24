import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures.js';

test.describe('My orders', () => {
  test('cancelling an order from the UI updates its status and returns stock', async ({ authedApi, orders, db }) => {
    // Arrange through the API (fast), act and assert through the UI.
    const p = await db.createProduct({ stock: 5 });
    const order = await (await authedApi.createOrder([{ productId: p.id, quantity: 2 }])).json();

    await orders.goto();
    await expect(orders.row(order.id).getByTestId('order-status')).toHaveText('CREATED');
    await orders.cancel(order.id);

    await expect(orders.row(order.id).getByTestId('order-status')).toHaveText('CANCELLED');
    await expect(orders.row(order.id).getByRole('button', { name: /cancel/i })).toHaveCount(0);
    expect(await db.stockOf(p.id)).toBe(5);
  });
});

test.describe('Accessibility (axe-core, WCAG 2.1 A/AA)', () => {
  const scan = (page: import('@playwright/test').Page) =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();

  test('login page has no detectable violations', async ({ page }) => {
    await page.goto('/#/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect((await scan(page)).violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  for (const view of [
    { path: '/#/catalog', heading: 'Catalog' },
    { path: '/#/cart', heading: 'Your cart' },
    { path: '/#/orders', heading: 'My orders' },
  ]) {
    test(`${view.heading} page has no detectable violations`, async ({ loggedInPage: page }) => {
      await page.goto(view.path);
      await expect(page.getByRole('heading', { name: view.heading })).toBeVisible();
      expect((await scan(page)).violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});
