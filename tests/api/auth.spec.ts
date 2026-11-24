import { expect, test } from '../support/fixtures.js';
import { ErrorSchema, LoginResponseSchema } from '../support/schemas.js';
import { users } from '../support/test-data.js';

test.describe('POST /api/auth/login', () => {
  test('returns a token and the public user profile for valid credentials @smoke', async ({ api }) => {
    const res = await api.login(users.standard.email, users.standard.password);

    expect(res.status()).toBe(200);
    const body = LoginResponseSchema.parse(await res.json());
    expect(body.user).toMatchObject({ email: users.standard.email, name: users.standard.name });
  });

  test('treats the email as case-insensitive', async ({ api }) => {
    const res = await api.login(users.standard.email.toUpperCase(), users.standard.password);
    expect(res.status()).toBe(200);
  });

  test('gives the same answer for a wrong password and an unknown email (no account enumeration)', async ({ api }) => {
    const wrongPassword = await api.login(users.standard.email, 'wrong-password');
    const unknownEmail = await api.login('nobody@shoplite.test', 'wrong-password');

    expect(wrongPassword.status()).toBe(401);
    expect(unknownEmail.status()).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
  });

  test('rejects a locked account with 423', async ({ api }) => {
    const res = await api.login(users.locked.email, users.locked.password);

    expect(res.status()).toBe(423);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe('ACCOUNT_LOCKED');
  });

  const invalidBodies = [
    { name: 'missing email', data: { password: 'x' } },
    { name: 'missing password', data: { email: users.standard.email } },
    { name: 'malformed email', data: { email: 'not-an-email', password: 'x' } },
    { name: 'empty password', data: { email: users.standard.email, password: '' } },
    { name: 'wrong types', data: { email: 123, password: true } },
  ];
  for (const { name, data } of invalidBodies) {
    test(`validates the body: ${name} → 400`, async ({ request }) => {
      const res = await request.post('/api/auth/login', { data });

      expect(res.status()).toBe(400);
      expect(ErrorSchema.parse(await res.json()).error.code).toBe('VALIDATION_ERROR');
    });
  }

  test('answers 400 (not 500) to malformed JSON', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: '{"email": "a@b.c", ',
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('MALFORMED_JSON');
  });
});

test.describe('Protected routes', () => {
  test('reject requests without a token', async ({ request }) => {
    const res = await request.get('/api/orders');
    expect(res.status()).toBe(401);
  });

  test('reject a tampered token', async ({ api, request }) => {
    const { token } = await api.loginAs('standard');
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');

    const res = await request.get('/api/orders', { headers: { Authorization: `Bearer ${tampered}` } });
    expect(res.status()).toBe(401);
  });

  test('reject a non-Bearer authorization scheme', async ({ request }) => {
    const res = await request.get('/api/orders', { headers: { Authorization: 'Basic dXNlcjpwYXNz' } });
    expect(res.status()).toBe(401);
  });
});
