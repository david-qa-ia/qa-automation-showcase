import { z } from 'zod';

// Response contracts. `.strict()` makes a test fail if the API starts
// leaking fields nobody agreed on (e.g. password_hash).

export const ErrorSchema = z
  .object({
    error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }).strict(),
  })
  .strict();

export const UserSchema = z.object({ id: z.number().int(), email: z.email(), name: z.string() }).strict();

export const LoginResponseSchema = z.object({ token: z.string().min(20), user: UserSchema }).strict();

export const ProductSchema = z
  .object({
    id: z.number().int().positive(),
    sku: z.string(),
    name: z.string().min(1),
    category: z.string(),
    priceCents: z.number().int().positive(),
    stock: z.number().int().nonnegative(),
    inStock: z.boolean(),
  })
  .strict();

export const ProductListSchema = z
  .object({
    items: z.array(ProductSchema),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const OrderSchema = z
  .object({
    id: z.number().int().positive(),
    status: z.enum(['CREATED', 'CANCELLED']),
    couponCode: z.string().nullable(),
    subtotalCents: z.number().int().nonnegative(),
    discountCents: z.number().int().nonnegative(),
    totalCents: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    items: z
      .array(
        z
          .object({
            productId: z.number().int(),
            name: z.string(),
            quantity: z.number().int().positive(),
            unitPriceCents: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type Order = z.infer<typeof OrderSchema>;
export type Product = z.infer<typeof ProductSchema>;
