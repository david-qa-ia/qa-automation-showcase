import { expect, test } from './fixtures.js';

// Network mocking: force the failure modes that are hard to reproduce for real.
test.describe('Resilience (mocked network)', () => {
  test('shows a friendly message when the catalog API fails', async ({ loggedInPage: page, catalog }) => {
    await page.route('**/api/products*', (route) =>
      route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } } }),
    );

    await catalog.goto();

    await expect(catalog.error).toHaveText('Unexpected error');
    await expect(catalog.cards).toHaveCount(0);
  });

  test('renders an empty state for an empty catalog', async ({ loggedInPage: page, catalog }) => {
    await page.route('**/api/products*', (route) =>
      route.fulfill({ json: { items: [], page: 1, limit: 20, total: 0 } }),
    );

    await catalog.goto();
    await expect(page.getByText('No products match your search.')).toBeVisible();
  });

  test('sends the user back to login when the session expires mid-flow', async ({ loggedInPage: page, orders }) => {
    await page.route('**/api/orders', (route) =>
      route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } } }),
    );

    await orders.goto();
    await expect(page).toHaveURL(/#\/login$/);
  });

  test('does not break when the API is slow', async ({ loggedInPage: page, catalog }) => {
    await page.route('**/api/products*', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    await catalog.goto();
    // Web-first assertion: waits for the content instead of a hard-coded sleep.
    await expect(catalog.cards.first()).toBeVisible();
  });
});
