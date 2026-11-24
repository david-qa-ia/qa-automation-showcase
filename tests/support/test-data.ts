export const PASSWORD = 'Passw0rd!';

export const users = {
  standard: { email: 'standard@shoplite.test', password: PASSWORD, name: 'Standard User' },
  other: { email: 'other@shoplite.test', password: PASSWORD, name: 'Other User' },
  locked: { email: 'locked@shoplite.test', password: PASSWORD, name: 'Locked User' },
} as const;

export type UserKey = keyof typeof users;

export const coupons = {
  welcome10: { code: 'WELCOME10', percentOff: 10 },
  halfOff: { code: 'HALFOFF', percentOff: 50 },
  expired: { code: 'EXPIRED20', percentOff: 20 },
} as const;

/** Mirrors the business rule: discount rounded to the nearest cent. */
export function expectedTotals(subtotalCents: number, percentOff = 0) {
  const discountCents = Math.round((subtotalCents * percentOff) / 100);
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}

export function uniqueSku(prefix = 'TST') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}
