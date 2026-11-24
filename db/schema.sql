-- ShopLite schema. Business rules live in constraints too, so the
-- data-integrity suite can prove the database refuses bad data on its own.

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  locked        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  sku         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  stock       INTEGER NOT NULL CHECK (stock >= 0),
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE coupons (
  code        TEXT PRIMARY KEY,
  percent_off INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE orders (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  status         TEXT NOT NULL CHECK (status IN ('CREATED', 'CANCELLED')),
  coupon_code    TEXT REFERENCES coupons(code),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents    INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (total_cents = subtotal_cents - discount_cents)
);

CREATE TABLE order_items (
  id               SERIAL PRIMARY KEY,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  UNIQUE (order_id, product_id)
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
