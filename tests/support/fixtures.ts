import { test as base, expect, type Page } from '@playwright/test';
import { ShopApi } from './api-client.js';
import { TestDb } from './db.js';
import { users, type UserKey } from './test-data.js';

interface TestFixtures {
  /** Anonymous API client. */
  api: ShopApi;
  /** API client already authenticated as the standard user. */
  authedApi: ShopApi;
  /** Factory for extra authenticated clients (e.g. a second user). */
  apiAs: (user: UserKey) => Promise<ShopApi>;
  /** Browser page with a session injected via API login (skips the login UI). */
  loggedInPage: Page;
}

interface WorkerFixtures {
  db: TestDb;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  db: [
    async ({}, use) => {
      const db = new TestDb();
      await use(db);
      await db.close();
    },
    { scope: 'worker' },
  ],

  api: async ({ request }, use) => {
    await use(new ShopApi(request));
  },

  authedApi: async ({ request }, use) => {
    const api = new ShopApi(request);
    await api.loginAs('standard');
    await use(api);
  },

  apiAs: async ({ playwright, baseURL }, use) => {
    const contexts: Awaited<ReturnType<typeof playwright.request.newContext>>[] = [];
    await use(async (user) => {
      const ctx = await playwright.request.newContext({ baseURL });
      contexts.push(ctx);
      const api = new ShopApi(ctx);
      await api.loginAs(user);
      return api;
    });
    await Promise.all(contexts.map((c) => c.dispose()));
  },

  loggedInPage: async ({ page, request }, use) => {
    const res = await request.post('/api/auth/login', {
      data: { email: users.standard.email, password: users.standard.password },
    });
    expect(res).toBeOK();
    const { token, user } = await res.json();
    await page.addInitScript(
      ([t, u]) => {
        if (!localStorage.getItem('token')) {
          localStorage.setItem('token', t);
          localStorage.setItem('user', u);
        }
      },
      [token, JSON.stringify(user)],
    );
    await use(page);
  },
});

export { expect };
