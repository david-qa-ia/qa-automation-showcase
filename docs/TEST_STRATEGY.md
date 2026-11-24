# Test strategy — ShopLite

## 1. Scope

ShopLite is a small e-commerce flow: sign in → browse catalog → cart → checkout (with coupons) → my orders → cancel.

**In scope:** authentication, catalog search/filter/pagination, order creation (pricing, coupons, stock), authorization between users, cancellation, data persistence, basic accessibility, UI behaviour on API failures.

**Out of scope (for this project):** payments, emails, load testing, mobile apps, cross-browser beyond Chromium and Firefox.

## 2. Risk analysis

Coverage is driven by risk (impact × likelihood), not by counting screens.

| Risk | Impact | Where it is covered |
|---|---|---|
| Wrong order total (pricing, coupon rounding) | High: money | API (`orders.spec.ts`), DB data-quality checks, E2E smoke |
| Overselling stock under concurrent purchases | High: money + trust | API race-condition test, DB `CHECK (stock >= 0)` |
| A user sees or cancels another user's order (IDOR) | High: security | API authorization tests |
| Partial writes when an order fails | High: data corruption | API atomicity test + DB "no partial rows" test |
| Client tampering with prices | High: money | API "ignores client-supplied price" |
| Login leaks which emails exist | Medium: security | API account-enumeration test |
| Double click creates duplicate orders | Medium | E2E double-submit test |
| UI breaks when the API fails or is slow | Medium | E2E network-mocked resilience tests |
| Accessibility regressions | Medium | axe-core scans on key pages |

## 3. Test pyramid

```
        E2E (Playwright UI)        ~21 tests  · critical journeys only, Chromium + Firefox
     ───────────────────────────
     Postman / Newman              17 requests · living API documentation + smoke
   ─────────────────────────────────
   API (Playwright request)        ~54 tests  · business rules, validation, auth, contracts
 ───────────────────────────────────────
 DB (SQL)                          ~12 tests  · persistence, constraints, data-quality queries
```

The bulk of the rules are checked at API level (fast, stable, precise). The UI layer only covers what a user actually does end to end, plus behaviour that only exists in the browser (double submit, error messages, accessibility).

## 4. Test design techniques used

- **Equivalence partitioning & boundary values:** `limit` 0/1/50/51, `quantity` 0/1/20/21, stock exactly equal vs. one over.
- **Negative testing:** malformed JSON, wrong types, missing fields, tampered tokens, SQL injection strings.
- **State transitions:** order `CREATED → CANCELLED`, and the invalid `CANCELLED → CANCELLED`.
- **Contract testing:** strict Zod schemas fail the build if the API adds or drops fields.
- **Concurrency testing:** 8 parallel buyers for 5 units.
- **Data-driven tests:** tables of inputs generated into individual, named tests.

## 5. Test data

- `globalSetup` rebuilds the database once per run from `db/schema.sql` + `db/seed.sql`.
- Every test that changes data creates **its own products** through `TestDb.createProduct()` with a unique SKU. Tests are independent and safe to run in parallel and in any order.
- Read-only tests use the seeded reference catalog.

## 6. Flakiness policy

- No fixed sleeps: only web-first assertions (`expect(locator).toBeVisible()`), which auto-wait.
- User-facing locators (`getByRole`, `getByLabel`), with `data-testid` only for values without a semantic role.
- Suite verified with `--repeat-each=3 --workers=4` (261 runs, 0 failures) before merging.
- CI retries once; a test that passes only on retry is reported as *flaky* in the HTML report and is fixed, not ignored.

## 7. CI gates (GitHub Actions)

1. Typecheck (`tsc --noEmit`)
2. Playwright: `api`, `db`, `e2e-chromium`, `e2e-firefox` projects against a real PostgreSQL service container
3. Newman run of the Postman collection
4. Artifacts: HTML report always; traces, screenshots, videos and JUnit XML on failure
5. Nightly scheduled run on weekdays

## 8. What stays manual

Exploratory sessions on new features, visual and UX review, and the manual cases in [MANUAL_TEST_CASES.md](./MANUAL_TEST_CASES.md) that aren't worth automating yet. Each manual case says whether it's automated and where.
