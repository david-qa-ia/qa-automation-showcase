-- Reference catalog. Tests that change stock create their own products
-- (see tests/support/db.ts) so parallel workers never fight over this data.

INSERT INTO products (sku, name, category, price_cents, stock) VALUES
  ('KB-001',  'Mechanical Keyboard',        'peripherals', 8999, 25),
  ('MS-001',  'Wireless Mouse',             'peripherals', 2999, 40),
  ('MN-001',  '27" 4K Monitor',             'displays',   34999, 8),
  ('HS-001',  'Noise-Cancelling Headset',   'audio',      12999, 15),
  ('CB-001',  'USB-C Cable 2m',             'accessories', 1299, 100),
  ('DK-001',  'Laptop Docking Station',     'accessories', 15999, 5),
  ('WC-001',  '1080p Webcam',               'peripherals', 5999, 0),
  ('SP-001',  'Bluetooth Speaker',          'audio',       7999, 12);

INSERT INTO coupons (code, percent_off, active) VALUES
  ('WELCOME10', 10, TRUE),
  ('HALFOFF',   50, TRUE),
  ('EXPIRED20', 20, FALSE);
