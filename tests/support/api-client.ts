import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { users, type UserKey } from './test-data.js';

export interface OrderItemInput {
  productId: number;
  quantity: number;
}

/**
 * Thin client over Playwright's APIRequestContext.
 * Methods return the raw APIResponse so each test decides what to assert
 * (status, headers, schema), instead of the client hiding failures.
 */
export class ShopApi {
  private token?: string;

  constructor(private readonly request: APIRequestContext) {}

  private headers(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  login(email: string, password: string) {
    return this.request.post('/api/auth/login', { data: { email, password } });
  }

  async loginAs(user: UserKey) {
    const res = await this.login(users[user].email, users[user].password);
    expect(res, `login as ${user}`).toBeOK();
    const body = await res.json();
    this.token = body.token;
    return body as { token: string; user: { id: number; email: string; name: string } };
  }

  withToken(token: string) {
    this.token = token;
    return this;
  }

  listProducts(params: Record<string, string | number> = {}) {
    return this.request.get('/api/products', { params });
  }

  getProduct(id: number | string) {
    return this.request.get(`/api/products/${id}`);
  }

  createOrder(items: OrderItemInput[], couponCode?: string): Promise<APIResponse> {
    return this.request.post('/api/orders', { headers: this.headers(), data: { items, couponCode } });
  }

  createOrderRaw(data: unknown) {
    return this.request.post('/api/orders', { headers: this.headers(), data });
  }

  getOrder(id: number) {
    return this.request.get(`/api/orders/${id}`, { headers: this.headers() });
  }

  listOrders() {
    return this.request.get('/api/orders', { headers: this.headers() });
  }

  cancelOrder(id: number) {
    return this.request.post(`/api/orders/${id}/cancel`, { headers: this.headers() });
  }
}
