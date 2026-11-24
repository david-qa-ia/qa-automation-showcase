import { users } from '../support/test-data.js';
import { expect, test } from './fixtures.js';

test.describe('Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('a registered user signs in and lands on the catalog @smoke', async ({ page, loginPage }) => {
    await loginPage.login(users.standard.email, users.standard.password);

    await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
    await expect(page.getByTestId('user-name')).toHaveText(users.standard.name);
    await expect(page).toHaveURL(/#\/catalog$/);
  });

  test('shows an error for wrong credentials and stays on the login page', async ({ page, loginPage }) => {
    await loginPage.login(users.standard.email, 'wrong-password');

    await expect(loginPage.error).toHaveText('Email or password is incorrect');
    await expect(page).toHaveURL(/#\/login$/);
  });

  test('tells a locked user their account is locked', async ({ loginPage }) => {
    await loginPage.login(users.locked.email, users.locked.password);
    await expect(loginPage.error).toHaveText('This account is locked');
  });

  test('validates empty fields before calling the API', async ({ page, loginPage }) => {
    let loginCalls = 0;
    page.on('request', (r) => r.url().includes('/api/auth/login') && loginCalls++);

    await loginPage.submit.click();

    await expect(loginPage.error).toHaveText('Email and password are required');
    expect(loginCalls).toBe(0);
  });

  test('redirects anonymous visitors from protected pages to login', async ({ page }) => {
    await page.goto('/#/orders');
    await expect(page).toHaveURL(/#\/login$/);
  });

  test('logging out clears the session', async ({ page, loginPage }) => {
    await loginPage.login(users.standard.email, users.standard.password);
    await page.getByRole('button', { name: 'Log out' }).click();

    await expect(page).toHaveURL(/#\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    await page.goto('/#/catalog');
    await expect(page).toHaveURL(/#\/login$/);
  });
});
