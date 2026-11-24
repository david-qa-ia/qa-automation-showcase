import { expect, test } from '../support/fixtures.js';
import { users } from '../support/test-data.js';

/**
 * The API can answer 201 and still persist the wrong thing.
 * These tests go through the API (act) and then check the database (assert).
 */
test.describe('Order persistence', () => {
  test('stores the order, its lines and the stock movement consistently', async ({ authedApi, db }) => {
    const p1 = await db.createProduct({ priceCents: 1500, stock: 10 });
    const p2 = await db.createProduct({ priceCents: 700, stock: 10 });

    const order = await (
      await authedApi.createOrder(
        [
          { productId: p1.id, quantity: 2 },
          { productId: p2.id, quantity: 5 },
        ],
        'WELCOME10',
      )
    ).json();

    const [row] = await db.query(
      `SELECT o.user_id, o.status, o.coupon_code, o.subtotal_cents, o.discount_cents, o.total_cents,
              SUM(oi.quantity * oi.unit_price_cents)::int AS lines_total,
              COUNT(oi.id)::int AS line_count
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
        WHERE o.id = $1
        GROUP BY o.id`,
      [order.id],
    );

    expect(row).toEqual({
      user_id: await db.userId(users.standard.email),
      status: 'CREATED',
      coupon_code: 'WELCOME10',
      subtotal_cents: 6500,
      discount_cents: 650,
      total_cents: 5850,
      lines_total: 6500,
      line_count: 2,
    });
    expect(await db.stockOf(p1.id)).toBe(8);
    expect(await db.stockOf(p2.id)).toBe(5);
  });

  test('freezes the unit price at purchase time', async ({ authedApi, db }) => {
    const p = await db.createProduct({ priceCents: 1000 });
    const order = await (await authedApi.createOrder([{ productId: p.id, quantity: 1 }])).json();

    await db.query('UPDATE products SET price_cents = 9999 WHERE id = $1', [p.id]);

    const [line] = await db.query('SELECT unit_price_cents FROM order_items WHERE order_id = $1', [order.id]);
    expect(line.unit_price_cents).toBe(1000);
    expect((await (await authedApi.getOrder(order.id)).json()).totalCents).toBe(1000);
  });

  test('a rejected order leaves no partial rows behind', async ({ authedApi, db }) => {
    const ok = await db.createProduct({ stock: 10 });
    const scarce = await db.createProduct({ stock: 1 });

    const res = await authedApi.createOrder([
      { productId: ok.id, quantity: 1 },
      { productId: scarce.id, quantity: 2 },
    ]);
    expect(res.status()).toBe(409);

    // Scoped to this test's products: other workers are creating orders in parallel.
    const [{ n: lines }] = await db.query(
      'SELECT count(*)::int AS n FROM order_items WHERE product_id = ANY($1)',
      [[ok.id, scarce.id]],
    );
    expect(lines).toBe(0);
    expect(await db.stockOf(ok.id)).toBe(10);
  });
});

test.describe('Database constraints (last line of defence)', () => {
  test('stock can never go negative', async ({ db }) => {
    const p = await db.createProduct({ stock: 1 });
    await expect(db.query('UPDATE products SET stock = stock - 2 WHERE id = $1', [p.id])).rejects.toThrow(
      /violates check constraint "products_stock_check"/,
    );
  });

  test('an order total must equal subtotal minus discount', async ({ db }) => {
    const userId = await db.userId(users.standard.email);
    await expect(
      db.query(
        `INSERT INTO orders (user_id, status, subtotal_cents, discount_cents, total_cents)
         VALUES ($1, 'CREATED', 1000, 100, 1000)`,
        [userId],
      ),
    ).rejects.toThrow(/violates check constraint/);
  });

  test('order status only accepts known values', async ({ db }) => {
    const userId = await db.userId(users.standard.email);
    await expect(
      db.query(
        `INSERT INTO orders (user_id, status, subtotal_cents, discount_cents, total_cents)
         VALUES ($1, 'SHIPPED_TO_MARS', 0, 0, 0)`,
        [userId],
      ),
    ).rejects.toThrow(/orders_status_check/);
  });

  test('emails are unique', async ({ db }) => {
    await expect(
      db.query(`INSERT INTO users (email, name, password_hash) VALUES ($1, 'Dup', 'x:y')`, [users.standard.email]),
    ).rejects.toThrow(/duplicate key value violates unique constraint "users_email_key"/);
  });

  test('order lines cannot point to a product that does not exist', async ({ authedApi, db }) => {
    const p = await db.createProduct();
    const order = await (await authedApi.createOrder([{ productId: p.id, quantity: 1 }])).json();
    await expect(
      db.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES ($1, 999999, 1, 100)',
        [order.id],
      ),
    ).rejects.toThrow(/violates foreign key constraint/);
  });
});

test.describe('Data quality checks', () => {
  // Queries a QA would run against staging after a release or a migration.
  test('no order has a total that disagrees with its lines', async ({ db }) => {
    const mismatches = await db.query(`
      SELECT o.id
        FROM orders o JOIN order_items oi ON oi.order_id = o.id
       GROUP BY o.id, o.subtotal_cents
      HAVING SUM(oi.quantity * oi.unit_price_cents) <> o.subtotal_cents`);
    expect(mismatches).toEqual([]);
  });

  test('no order exists without lines', async ({ db }) => {
    const orphans = await db.query(`
      SELECT o.id FROM orders o
       WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)`);
    expect(orphans).toEqual([]);
  });

  test('passwords are never stored in plain text', async ({ db }) => {
    const rows = await db.query(`SELECT email FROM users WHERE password_hash !~ '^[0-9a-f]{32}:[0-9a-f]{64}$'`);
    expect(rows).toEqual([]);
  });

  test('every discount matches an active-or-historic coupon percentage', async ({ db }) => {
    const wrong = await db.query(`
      SELECT o.id FROM orders o JOIN coupons c ON c.code = o.coupon_code
       WHERE o.discount_cents <> ROUND(o.subtotal_cents * c.percent_off / 100.0)`);
    expect(wrong).toEqual([]);
  });
});
