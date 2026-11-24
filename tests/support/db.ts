import pg from 'pg';
import { uniqueSku } from './test-data.js';

export interface NewProduct {
  name?: string;
  category?: string;
  priceCents?: number;
  stock?: number;
}

/**
 * Direct database access for tests:
 *  - arrange: create isolated test data that the public API can't create
 *  - assert: verify what the API really persisted, not just what it answered
 */
export class TestDb {
  private readonly pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/shoplite',
    max: 3,
  });

  async query<T extends pg.QueryResultRow = Record<string, any>>(sql: string, params: unknown[] = []) {
    const { rows } = await this.pool.query<T>(sql, params);
    return rows;
  }

  async createProduct(p: NewProduct = {}) {
    const sku = uniqueSku();
    const [row] = await this.query<{ id: number }>(
      `INSERT INTO products (sku, name, category, price_cents, stock)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [sku, p.name ?? `Test product ${sku}`, p.category ?? 'test', p.priceCents ?? 1000, p.stock ?? 10],
    );
    return { id: row.id, sku, name: p.name ?? `Test product ${sku}`, priceCents: p.priceCents ?? 1000 };
  }

  async stockOf(productId: number) {
    const [row] = await this.query<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [productId]);
    return row.stock;
  }

  async userId(email: string) {
    const [row] = await this.query<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
    return row.id;
  }

  close() {
    return this.pool.end();
  }
}
