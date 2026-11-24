import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { ApiError } from '../errors.js';

const ListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const IdParam = z.object({ id: z.coerce.number().int().positive() });

export function toProduct(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    sku: row.sku as string,
    name: row.name as string,
    category: row.category as string,
    priceCents: row.price_cents as number,
    stock: row.stock as number,
    inStock: (row.stock as number) > 0,
  };
}

export const productsRouter = Router();

productsRouter.get('/', async (req, res) => {
  const q = ListQuery.parse(req.query);
  const where = ['active = TRUE'];
  const params: unknown[] = [];
  if (q.search) {
    params.push(`%${q.search}%`);
    where.push(`name ILIKE $${params.length}`);
  }
  if (q.category) {
    params.push(q.category);
    where.push(`category = $${params.length}`);
  }
  const whereSql = where.join(' AND ');
  const total = await pool.query(`SELECT count(*)::int AS n FROM products WHERE ${whereSql}`, params);
  params.push(q.limit, (q.page - 1) * q.limit);
  const { rows } = await pool.query(
    `SELECT * FROM products WHERE ${whereSql} ORDER BY id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  res.json({ items: rows.map(toProduct), page: q.page, limit: q.limit, total: total.rows[0].n });
});

productsRouter.get('/:id', async (req, res) => {
  const { id } = IdParam.parse(req.params);
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1 AND active = TRUE', [id]);
  if (!rows[0]) throw new ApiError(404, 'NOT_FOUND', `Product ${id} not found`);
  res.json(toProduct(rows[0]));
});
