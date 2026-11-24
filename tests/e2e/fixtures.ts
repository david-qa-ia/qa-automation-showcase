import { test as base, expect } from '../support/fixtures.js';
import { CartPage } from './pages/CartPage.js';
import { CatalogPage } from './pages/CatalogPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { ConfirmationPage, OrdersPage } from './pages/OrdersPage.js';

interface Pages {
  loginPage: LoginPage;
  catalog: CatalogPage;
  cart: CartPage;
  confirmation: ConfirmationPage;
  orders: OrdersPage;
}

// Page objects are injected as fixtures, so specs read like the user journey.
// They are built on `loggedInPage`, except loginPage, which needs a fresh session.
export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  catalog: async ({ loggedInPage }, use) => use(new CatalogPage(loggedInPage)),
  cart: async ({ loggedInPage }, use) => use(new CartPage(loggedInPage)),
  confirmation: async ({ loggedInPage }, use) => use(new ConfirmationPage(loggedInPage)),
  orders: async ({ loggedInPage }, use) => use(new OrdersPage(loggedInPage)),
});

export { expect };
