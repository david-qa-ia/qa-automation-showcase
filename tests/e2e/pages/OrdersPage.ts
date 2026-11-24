import type { Locator, Page } from '@playwright/test';

export class ConfirmationPage {
  readonly heading: Locator;
  readonly orderId: Locator;
  readonly discount: Locator;
  readonly total: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Order confirmed' });
    this.orderId = page.getByTestId('order-id');
    this.discount = page.getByTestId('order-discount');
    this.total = page.getByTestId('order-total');
  }

  async orderNumber() {
    return Number((await this.orderId.textContent())!.replace('#', ''));
  }
}

export class OrdersPage {
  readonly heading: Locator;
  readonly rows: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'My orders' });
    this.rows = page.getByTestId('order-row');
  }

  async goto() {
    await this.page.goto('/#/orders');
  }

  row(orderId: number) {
    return this.rows.filter({ hasText: `#${orderId}` });
  }

  async cancel(orderId: number) {
    await this.page.getByRole('button', { name: `Cancel order ${orderId}` }).click();
  }
}
