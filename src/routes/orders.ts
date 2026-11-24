import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { pool } from '../db.js';
import { ApiError } from '../errors.js';

const CreateOrderBody = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(20)
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, {
      message: 'Each product can appear only once',
    }),
  couponCode: z.string().trim().min(1).max(30).optional(),
});

const IdParam = z.object({ id: z.coerce.number().int().positive() });

async function loadOrder(orderId: number, userId: number) {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
  // 404 (not 403) for someone else's order, so ids can't be probed.
  if (!rows[0]) throw new ApiError(404, 'NOT_FOUND', `Order ${orderId} not found`);
  const items = await pool.query(
    `SELECT oi.product_id, p.name, oi.quantity, oi.unit_price_cents
       FROM order_items oi JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1 ORDER BY oi.id`,
    [orderId],
  );
  const o = rows[0];
  return {
    id: o.id,
    status: o.status,
    couponCode: o.coupon_code,
    subtotalCents: o.subtotal_cents,
    discountCents: o.discount_cents,
    totalCents: o.total_cents,
    createdAt: o.created_at,
    items: items.rows.map((i) => ({
      productId: i.product_id,
      name: i.name,
      quantity: i.quantity,
      unitPriceCents: i.unit_price_cents,
    })),
  };
}

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

ordersRouter.post('/', async (req: AuthedRequest, res) => {
  const body = CreateOrderBody.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let percentOff = 0;
    if (body.couponCode) {
      const c = await client.query('SELECT percent_off FROM coupons WHERE code = $1 AND active = TRUE', [
        body.couponCode.toUpperCase(),
      ]);
      if (!c.rows[0]) throw new ApiError(422, 'INVALID_COUPON', 'Coupon is invalid or expired');
      percentOff = c.rows[0].percent_off;
    }

    // Lock the product rows so two concurrent orders can't oversell the same stock.
    const ids = body.items.map((i) => i.productId);
    const { rows: products } = await client.query(
      'SELECT id, name, price_cents, stock FROM products WHERE id = ANY($1) AND active = TRUE ORDER BY id FOR UPDATE',
      [ids],
    );
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    for (const item of body.items) {
      const p = byId.get(item.productId);
      if (!p) throw new ApiError(404, 'PRODUCT_NOT_FOUND', `Product ${item.productId} not found`);
      if (p.stock < item.quantity) {
        throw new ApiError(409, 'INSUFFICIENT_STOCK', `Only ${p.stock} unit(s) of "${p.name}" left`, {
          productId: p.id,
          available: p.stock,
        });
      }
      subtotal += p.price_cents * item.quantity;
    }
    const discount = Math.round((subtotal * percentOff) / 100);

    const order = await client.query(
      `INSERT INTO orders (user_id, status, coupon_code, subtotal_cents, discount_cents, total_cents)
       VALUES ($1, 'CREATED', $2, $3, $4, $5) RETURNING id`,
      [req.userId, body.couponCode ? body.couponCode.toUpperCase() : null, subtotal, discount, subtotal - discount],
    );
    const orderId = order.rows[0].id;
    for (const item of body.items) {
      const p = byId.get(item.productId);
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)',
        [orderId, item.productId, item.quantity, p.price_cents],
      );
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.productId]);
    }
    await client.query('COMMIT');
    res.status(201).json(await loadOrder(orderId, req.userId!));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

ordersRouter.get('/', async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    'SELECT id, status, total_cents, created_at FROM orders WHERE user_id = $1 ORDER BY id DESC',
    [req.userId],
  );
  res.json({
    items: rows.map((o) => ({ id: o.id, status: o.status, totalCents: o.total_cents, createdAt: o.created_at })),
  });
});

ordersRouter.get('/:id', async (req: AuthedRequest, res) => {
  const { id } = IdParam.parse(req.params);
  res.json(await loadOrder(id, req.userId!));
});

ordersRouter.post('/:id/cancel', async (req: AuthedRequest, res) => {
  const { id } = IdParam.parse(req.params);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT status FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE', [
      id,
      req.userId,
    ]);
    if (!rows[0]) throw new ApiError(404, 'NOT_FOUND', `Order ${id} not found`);
    if (rows[0].status === 'CANCELLED') throw new ApiError(409, 'ALREADY_CANCELLED', 'Order is already cancelled');
    await client.query(
      `UPDATE products p SET stock = p.stock + oi.quantity
         FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`,
      [id],
    );
    await client.query(`UPDATE orders SET status = 'CANCELLED' WHERE id = $1`, [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  res.json(await loadOrder(id, req.userId!));
});
