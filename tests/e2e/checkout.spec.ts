import { expect, test } from './fixtures.js';

/** Unique per test run and worker, so searches only ever match this test's products. */
const tag = (label: string) => `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

test.describe('Checkout', () => {
  test('buys two products with a coupon, end to end, and the database agrees @smoke', async ({
    catalog,
    cart,
    confirmation,
    db,
  }) => {
    const run = tag('E2E');
    const keyboard = await db.createProduct({ name: `${run} Keyboard`, priceCents: 5000, stock: 5 });
    const mouse = await db.createProduct({ name: `${run} Mouse`, priceCents: 2000, stock: 5 });

    await catalog.goto();
    await catalog.searchFor(run);
    await catalog.addToCart(keyboard.name, 2);
    await catalog.addToCart(mouse.name);
    await expect(catalog.cartCount).toHaveText('3');

    await catalog.openCart();
    await expect(cart.rows).toHaveCount(2);
    await expect(cart.subtotal).toHaveText('$120.00');
    await cart.checkout('WELCOME10');

    await expect(confirmation.heading).toBeVisible();
    await expect(confirmation.discount).toHaveText('$12.00');
    await expect(confirmation.total).toHaveText('$108.00');
    await expect(catalog.cartCount).toHaveText('0');

    // UI said it worked; confirm it really did.
    const orderId = await confirmation.orderNumber();
    const [order] = await db.query('SELECT total_cents, status FROM orders WHERE id = $1', [orderId]);
    expect(order).toEqual({ total_cents: 10800, status: 'CREATED' });
    expect(await db.stockOf(keyboard.id)).toBe(3);
  });

  test('updates the subtotal when quantities change and items are removed', async ({ catalog, cart, db }) => {
    const run = tag('Qty');
    const p1 = await db.createProduct({ name: `${run} A`, priceCents: 1000 });
    const p2 = await db.createProduct({ name: `${run} B`, priceCents: 2500 });

    await catalog.goto();
    await catalog.searchFor(run);
    await catalog.addToCart(p1.name);
    await catalog.addToCart(p2.name);
    await catalog.openCart();

    await cart.setQuantity(p1.name, 4);
    await expect(cart.subtotal).toHaveText('$65.00');

    await cart.remove(p2.name);
    await expect(cart.rows).toHaveCount(1);
    await expect(cart.subtotal).toHaveText('$40.00');

    await cart.remove(p1.name);
    await expect(cart.empty).toBeVisible();
  });

  test('shows the API error when an invalid coupon is used and keeps the cart', async ({ catalog, cart, db }) => {
    const p = await db.createProduct({ name: tag('Coupon test') });

    await catalog.goto();
    await catalog.searchFor(p.name);
    await catalog.addToCart(p.name);
    await catalog.openCart();
    await cart.checkout('EXPIRED20');

    await expect(cart.error).toHaveText('Coupon is invalid or expired');
    await expect(cart.rows).toHaveCount(1);
  });

  test('tells the user when stock ran out while the item was in the cart', async ({ catalog, cart, db }) => {
    const p = await db.createProduct({ name: tag('Last unit'), stock: 1 });

    await catalog.goto();
    await catalog.searchFor(p.name);
    await catalog.addToCart(p.name);
    // Someone else buys the last unit in the meantime.
    await db.query('UPDATE products SET stock = 0 WHERE id = $1', [p.id]);
    await catalog.openCart();
    await cart.checkout();

    await expect(cart.error).toContainText(`Only 0 unit(s) of "${p.name}" left`);
  });

  test('disables "Add to cart" for out-of-stock products', async ({ catalog }) => {
    await catalog.goto();
    await catalog.searchFor('Webcam');
    const card = catalog.card('1080p Webcam');

    await expect(card.getByText('Out of stock')).toBeVisible();
    await expect(card.getByRole('button', { name: /add .* to cart/i })).toBeDisabled();
  });

  test('prevents a double submit from creating two orders', async ({ loggedInPage: page, catalog, cart, db }) => {
    const p = await db.createProduct({ name: tag('Double click'), stock: 10 });
    // Slow the order request down so a second click lands while the first is in flight.
    await page.route('**/api/orders', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });

    await catalog.goto();
    await catalog.searchFor(p.name);
    await catalog.addToCart(p.name);
    await catalog.openCart();
    await cart.placeOrder.dblclick();

    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    const [{ n }] = await db.query('SELECT count(*)::int AS n FROM order_items WHERE product_id = $1', [p.id]);
    expect(n).toBe(1);
  });
});
