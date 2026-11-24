import { expect, test } from '../support/fixtures.js';
import { ErrorSchema, ProductListSchema, ProductSchema } from '../support/schemas.js';

test.describe('GET /api/products', () => {
  test('lists active products matching the contract @smoke', async ({ api }) => {
    const res = await api.listProducts();

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = ProductListSchema.parse(await res.json());
    expect(body.items.length).toBeGreaterThan(0);
    expect(body).toMatchObject({ page: 1, limit: 20 });
  });

  test('filters by category', async ({ api }) => {
    const body = ProductListSchema.parse(await (await api.listProducts({ category: 'audio' })).json());

    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((p) => p.category === 'audio')).toBe(true);
  });

  test('searches by name, case-insensitively', async ({ api }) => {
    const body = ProductListSchema.parse(await (await api.listProducts({ search: 'KEYBOARD' })).json());

    expect(body.items.map((p) => p.name)).toContain('Mechanical Keyboard');
  });

  test('treats search input as data, not SQL', async ({ api }) => {
    const res = await api.listProducts({ search: "' OR 1=1 --" });

    expect(res.status()).toBe(200);
    expect(ProductListSchema.parse(await res.json()).items).toHaveLength(0);
  });

  test('paginates without overlap between pages', async ({ api }) => {
    const page1 = ProductListSchema.parse(await (await api.listProducts({ limit: 3, page: 1 })).json());
    const page2 = ProductListSchema.parse(await (await api.listProducts({ limit: 3, page: 2 })).json());

    expect(page1.items).toHaveLength(3);
    const ids1 = page1.items.map((p) => p.id);
    expect(page2.items.every((p) => !ids1.includes(p.id))).toBe(true);
    expect(Math.max(...ids1)).toBeLessThan(Math.min(...page2.items.map((p) => p.id)));
  });

  // Boundary values for `limit` (valid range 1..50) and `page` (>= 1)
  const boundaries: { params: Record<string, string | number>; status: number }[] = [
    { params: { limit: 0 }, status: 400 },
    { params: { limit: 1 }, status: 200 },
    { params: { limit: 50 }, status: 200 },
    { params: { limit: 51 }, status: 400 },
    { params: { page: 0 }, status: 400 },
    { params: { page: 'abc' }, status: 400 },
  ];
  for (const { params, status } of boundaries) {
    test(`boundary ${JSON.stringify(params)} → ${status}`, async ({ api }) => {
      const res = await api.listProducts(params);
      expect(res.status()).toBe(status);
      if (status === 400) ErrorSchema.parse(await res.json());
    });
  }

  test('reports out-of-stock products with inStock=false', async ({ api }) => {
    const body = ProductListSchema.parse(await (await api.listProducts({ search: 'Webcam' })).json());
    expect(body.items[0]).toMatchObject({ stock: 0, inStock: false });
  });
});

test.describe('GET /api/products/:id', () => {
  test('returns one product', async ({ api, db }) => {
    const created = await db.createProduct({ priceCents: 4321, stock: 3 });

    const res = await api.getProduct(created.id);
    expect(res.status()).toBe(200);
    expect(ProductSchema.parse(await res.json())).toMatchObject({ id: created.id, priceCents: 4321, stock: 3 });
  });

  test('returns 404 for a product that does not exist', async ({ api }) => {
    const res = await api.getProduct(999999);
    expect(res.status()).toBe(404);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe('NOT_FOUND');
  });

  test('returns 404 for an inactive product', async ({ api, db }) => {
    const created = await db.createProduct();
    await db.query('UPDATE products SET active = FALSE WHERE id = $1', [created.id]);

    expect((await api.getProduct(created.id)).status()).toBe(404);
  });

  test('returns 400 for a non-numeric id', async ({ api }) => {
    expect((await api.getProduct('abc')).status()).toBe(400);
  });
});
