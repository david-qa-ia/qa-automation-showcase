import { expect, test } from '../support/fixtures.js';
import { ErrorSchema, OrderSchema } from '../support/schemas.js';
import { coupons, expectedTotals } from '../support/test-data.js';

test.describe('POST /api/orders', () => {
  test('creates an order and calculates totals server-side @smoke', async ({ authedApi, db }) => {
    const a = await db.createProduct({ priceCents: 2500, stock: 10 });
    const b = await db.createProduct({ priceCents: 999, stock: 10 });

    const res = await authedApi.createOrder([
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 3 },
    ]);

    expect(res.status()).toBe(201);
    const order = OrderSchema.parse(await res.json());
    expect(order.status).toBe('CREATED');
    expect(order).toMatchObject(expectedTotals(2 * 2500 + 3 * 999));
    expect(order.items).toEqual([
      expect.objectContaining({ productId: a.id, quantity: 2, unitPriceCents: 2500 }),
      expect.objectContaining({ productId: b.id, quantity: 3, unitPriceCents: 999 }),
    ]);
  });

  test('ignores a client-supplied price', async ({ authedApi, db }) => {
    const p = await db.createProduct({ priceCents: 5000 });

    const res = await authedApi.createOrderRaw({
      items: [{ productId: p.id, quantity: 1, unitPriceCents: 1 }],
      totalCents: 1,
    });

    expect(res.status()).toBe(201);
    expect((await res.json()).totalCents).toBe(5000);
  });

  test.describe('coupons', () => {
    for (const coupon of [coupons.welcome10, coupons.halfOff]) {
      test(`applies ${coupon.code} (${coupon.percentOff}% off)`, async ({ authedApi, db }) => {
        const p = await db.createProduct({ priceCents: 3333 });

        const res = await authedApi.createOrder([{ productId: p.id, quantity: 3 }], coupon.code);

        expect(res.status()).toBe(201);
        expect(await res.json()).toMatchObject({
          couponCode: coupon.code,
          ...expectedTotals(3 * 3333, coupon.percentOff),
        });
      });
    }

    test('accepts coupon codes in any case', async ({ authedApi, db }) => {
      const p = await db.createProduct();
      const res = await authedApi.createOrder([{ productId: p.id, quantity: 1 }], 'welcome10');
      expect((await res.json()).couponCode).toBe('WELCOME10');
    });

    for (const code of [coupons.expired.code, 'DOESNOTEXIST']) {
      test(`rejects invalid coupon ${code} with 422 and does not touch stock`, async ({ authedApi, db }) => {
        const p = await db.createProduct({ stock: 5 });

        const res = await authedApi.createOrder([{ productId: p.id, quantity: 1 }], code);

        expect(res.status()).toBe(422);
        expect(ErrorSchema.parse(await res.json()).error.code).toBe('INVALID_COUPON');
        expect(await db.stockOf(p.id)).toBe(5);
      });
    }
  });

  test.describe('stock rules', () => {
    test('allows buying exactly the remaining stock', async ({ authedApi, db }) => {
      const p = await db.createProduct({ stock: 3 });

      const res = await authedApi.createOrder([{ productId: p.id, quantity: 3 }]);

      expect(res.status()).toBe(201);
      expect(await db.stockOf(p.id)).toBe(0);
    });

    test('rejects one unit over the stock with 409 and details', async ({ authedApi, db }) => {
      const p = await db.createProduct({ stock: 3 });

      const res = await authedApi.createOrder([{ productId: p.id, quantity: 4 }]);

      expect(res.status()).toBe(409);
      const { error } = ErrorSchema.parse(await res.json());
      expect(error.code).toBe('INSUFFICIENT_STOCK');
      expect(error.details).toEqual({ productId: p.id, available: 3 });
    });

    test('is atomic: one failing line rolls back the whole order', async ({ authedApi, db }) => {
      const ok = await db.createProduct({ stock: 10 });
      const scarce = await db.createProduct({ stock: 1 });

      const res = await authedApi.createOrder([
        { productId: ok.id, quantity: 2 },
        { productId: scarce.id, quantity: 2 },
      ]);

      expect(res.status()).toBe(409);
      expect(await db.stockOf(ok.id)).toBe(10);
      expect(await db.stockOf(scarce.id)).toBe(1);
    });

    test('does not oversell under concurrent orders (race condition)', async ({ apiAs, db }) => {
      const p = await db.createProduct({ stock: 5 });
      const buyers = await Promise.all(Array.from({ length: 8 }, () => apiAs('standard')));

      // 8 buyers fire at the same time for 1 unit each; only 5 units exist.
      const responses = await Promise.all(buyers.map((b) => b.createOrder([{ productId: p.id, quantity: 1 }])));
      const statuses = responses.map((r) => r.status());

      expect(statuses.filter((s) => s === 201)).toHaveLength(5);
      expect(statuses.filter((s) => s === 409)).toHaveLength(3);
      expect(await db.stockOf(p.id)).toBe(0);
    });
  });

  test.describe('request validation', () => {
    const cases = [
      { name: 'empty items', data: { items: [] } },
      { name: 'missing items', data: {} },
      { name: 'quantity 0', data: { items: [{ productId: 1, quantity: 0 }] } },
      { name: 'quantity 21 (max is 20)', data: { items: [{ productId: 1, quantity: 21 }] } },
      { name: 'negative quantity', data: { items: [{ productId: 1, quantity: -1 }] } },
      { name: 'decimal quantity', data: { items: [{ productId: 1, quantity: 1.5 }] } },
      { name: 'quantity as string', data: { items: [{ productId: 1, quantity: '2' }] } },
      { name: 'duplicate product lines', data: { items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 1 }] } },
    ];
    for (const { name, data } of cases) {
      test(`${name} → 400`, async ({ authedApi }) => {
        const res = await authedApi.createOrderRaw(data);
        expect(res.status()).toBe(400);
        expect(ErrorSchema.parse(await res.json()).error.code).toBe('VALIDATION_ERROR');
      });
    }

    test('unknown product → 404', async ({ authedApi }) => {
      const res = await authedApi.createOrder([{ productId: 999999, quantity: 1 }]);
      expect(res.status()).toBe(404);
      expect((await res.json()).error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });
});

test.describe('GET /api/orders/:id', () => {
  test('returns the owner their order', async ({ authedApi, db }) => {
    const p = await db.createProduct();
    const created = OrderSchema.parse(await (await authedApi.createOrder([{ productId: p.id, quantity: 1 }])).json());

    const res = await authedApi.getOrder(created.id);
    expect(res.status()).toBe(200);
    expect(OrderSchema.parse(await res.json())).toEqual(created);
  });

  test("hides another user's order with 404 (no IDOR)", async ({ authedApi, apiAs, db }) => {
    const p = await db.createProduct();
    const order = await (await authedApi.createOrder([{ productId: p.id, quantity: 1 }])).json();
    const otherUser = await apiAs('other');

    const res = await otherUser.getOrder(order.id);
    expect(res.status()).toBe(404);

    const cancel = await otherUser.cancelOrder(order.id);
    expect(cancel.status()).toBe(404);
  });

  test('lists only my orders, newest first', async ({ apiAs, db }) => {
    const p = await db.createProduct();
    const other = await apiAs('other');
    const first = await (await other.createOrder([{ productId: p.id, quantity: 1 }])).json();
    const second = await (await other.createOrder([{ productId: p.id, quantity: 1 }])).json();

    const { items } = await (await other.listOrders()).json();
    const ids = items.map((o: { id: number }) => o.id);

    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    const ownerIds = await db.query('SELECT DISTINCT user_id FROM orders WHERE id = ANY($1)', [ids]);
    expect(ownerIds).toHaveLength(1);
  });
});

test.describe('POST /api/orders/:id/cancel', () => {
  test('cancels the order and returns the stock', async ({ authedApi, db }) => {
    const p = await db.createProduct({ stock: 4 });
    const order = await (await authedApi.createOrder([{ productId: p.id, quantity: 3 }])).json();
    expect(await db.stockOf(p.id)).toBe(1);

    const res = await authedApi.cancelOrder(order.id);

    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe('CANCELLED');
    expect(await db.stockOf(p.id)).toBe(4);
  });

  test('refuses to cancel twice and does not return stock twice', async ({ authedApi, db }) => {
    const p = await db.createProduct({ stock: 4 });
    const order = await (await authedApi.createOrder([{ productId: p.id, quantity: 2 }])).json();
    await authedApi.cancelOrder(order.id);

    const second = await authedApi.cancelOrder(order.id);

    expect(second.status()).toBe(409);
    expect(await db.stockOf(p.id)).toBe(4);
  });
});
