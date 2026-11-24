import type { Locator, Page } from '@playwright/test';

export class CatalogPage {
  readonly heading: Locator;
  readonly search: Locator;
  readonly category: Locator;
  readonly cards: Locator;
  readonly cartCount: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Catalog' });
    this.search = page.getByLabel('Search products');
    this.category = page.getByLabel('Category');
    this.cards = page.getByTestId('product-card');
    this.cartCount = page.getByTestId('cart-count');
    this.error = page.locator('#catalog-error');
  }

  async goto() {
    await this.page.goto('/#/catalog');
  }

  card(productName: string) {
    return this.cards.filter({ has: this.page.getByRole('heading', { name: productName, exact: true }) });
  }

  async searchFor(text: string) {
    await this.search.fill(text);
  }

  async addToCart(productName: string, times = 1) {
    for (let i = 0; i < times; i++) {
      await this.card(productName).getByRole('button', { name: /add .* to cart/i }).click();
    }
  }

  async openCart() {
    await this.page.getByTestId('cart-link').click();
  }
}
