# Manual test cases — ShopLite

Format used for regression and exploratory work before (or instead of) automating. The **Automated** column traces each case to its automated coverage.

| ID | Title | Preconditions | Steps | Expected result | Priority | Automated |
|---|---|---|---|---|---|---|
| TC-01 | Sign in with valid credentials | User `standard@shoplite.test` exists | 1. Open `/#/login` 2. Enter email and password 3. Click **Sign in** | Catalog is shown; user name in the header | P1 | `e2e/login.spec.ts` |
| TC-02 | Sign in with wrong password | — | 1. Enter valid email, wrong password 2. Sign in | "Email or password is incorrect"; stays on login | P1 | `e2e/login.spec.ts`, `api/auth.spec.ts` |
| TC-03 | Locked account | User `locked@` is locked | Sign in with the locked user | "This account is locked" | P2 | `e2e/login.spec.ts` |
| TC-04 | Empty login form | — | Click **Sign in** with empty fields | Inline error, no request sent | P3 | `e2e/login.spec.ts` |
| TC-05 | Search catalog | Signed in | Type "keyboard" in search | Only matching products, case-insensitive | P2 | `api/products.spec.ts` |
| TC-06 | Out-of-stock product | Webcam has stock 0 | Find the webcam | "Out of stock", button disabled | P2 | `e2e/checkout.spec.ts` |
| TC-07 | Checkout with WELCOME10 | 2 products in cart, subtotal $120.00 | Apply `WELCOME10`, place order | Discount $12.00, total $108.00, order number shown, cart emptied | P1 | `e2e/checkout.spec.ts` |
| TC-08 | Expired coupon | Product in cart | Apply `EXPIRED20`, place order | "Coupon is invalid or expired"; cart kept; no stock change | P2 | `e2e/checkout.spec.ts`, `api/orders.spec.ts` |
| TC-09 | Stock runs out while in cart | Last unit in cart; another user buys it | Place order | Clear message with units left; no order created | P1 | `e2e/checkout.spec.ts` |
| TC-10 | Double click on Place order | Product in cart | Double-click **Place order** | Exactly one order | P2 | `e2e/checkout.spec.ts` |
| TC-11 | Cancel an order | An order in CREATED | My orders → Cancel | Status CANCELLED; stock returned; button gone | P1 | `e2e/orders-and-a11y.spec.ts` |
| TC-12 | Another user's order | Order belongs to user A | As user B, open `/api/orders/{id}` | 404, nothing revealed | P1 | `api/orders.spec.ts` |
| TC-13 | Session expires | Signed in | Token expires, then open My orders | Redirect to login with no broken screen | P2 | `e2e/resilience.spec.ts` |
| TC-14 | Keyboard-only checkout | — | Complete a purchase using only Tab/Enter | Every control reachable with visible focus | P3 | Manual (axe covers static rules only) |
| TC-15 | Visual review on mobile width | — | 375px viewport, go through the main flow | No overlapping or cut-off content | P3 | Manual |
