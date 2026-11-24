import type { Locator, Page } from '@playwright/test';

export class CartPage {
  readonly heading: Locator;
  readonly rows: Locator;
  readonly empty: Locator;
  readonly subtotal: Locator;
  readonly coupon: Locator;
  readonly placeOrder: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Your cart' });
    this.rows = page.locator('#cart-rows tr');
    this.empty = page.getByText('Your cart is empty.');
    this.subtotal = page.getByTestId('cart-subtotal');
    this.coupon = page.getByLabel('Coupon code (optional)');
    this.placeOrder = page.getByRole('button', { name: 'Place order' });
    this.error = page.locator('#checkout-error');
  }

  async setQuantity(productName: string, quantity: number) {
    const input = this.page.getByLabel(`Quantity of ${productName}`);
    await input.fill(String(quantity));
    await input.press('Tab');
  }

  async remove(productName: string) {
    await this.page.getByRole('button', { name: `Remove ${productName}` }).click();
  }

  async checkout(couponCode?: string) {
    if (couponCode) await this.coupon.fill(couponCode);
    await this.placeOrder.click();
  }
}
