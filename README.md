# QA Automation Showcase · Playwright · API · Postman · SQL

[![CI](https://github.com/david-qa-ia/qa-automation-showcase/actions/workflows/ci.yml/badge.svg)](https://github.com/david-qa-ia/qa-automation-showcase/actions/workflows/ci.yml)
![Playwright](https://img.shields.io/badge/Playwright-TypeScript-2EAD33?logo=playwright)
![Postman](https://img.shields.io/badge/Postman-Newman-FF6C37?logo=postman)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)

Test automation for a small e-commerce app, **ShopLite**, covering UI, API, a Postman collection and the database. It all runs in GitHub Actions against a real PostgreSQL.

I included the app itself instead of testing a public demo site, so I could test things you usually can't on someone else's system: concurrency, data integrity, isolated test data, and failure modes.

## What's covered

| Area | How |
|---|---|
| **UI automation** | Playwright + TypeScript, Page Object Model injected as fixtures, user-facing locators, web-first assertions, Chromium + Firefox |
| **API testing** | Playwright `request` tests for auth, validation, business rules, authorization (IDOR) and **strict contract validation** with Zod |
| **Postman** | Chained collection (token → product → order → cancel), JSON-schema checks, dynamic test data, run by **Newman** in CI with JUnit output |
| **SQL / database** | Assert what the API *persisted*, not just what it answered: totals vs. lines, stock movements, atomic rollbacks, DB constraints, data-quality queries |
| **Hard-to-test scenarios** | Race condition (8 concurrent buyers, 5 units), double submit, network mocking (500s, slow API, expired session), accessibility with axe-core |
| **Test strategy** | Risk-based [test strategy](docs/TEST_STRATEGY.md), [manual test cases](docs/MANUAL_TEST_CASES.md) with traceability, bug report template |
| **CI/CD** | GitHub Actions with a Postgres service container, typecheck gate, HTML report and traces as artifacts, nightly regression |

## Architecture

```mermaid
flowchart LR
  subgraph Tests
    E2E[Playwright UI<br/>Page Objects]
    API[Playwright API<br/>+ Zod contracts]
    PM[Postman / Newman]
    DB[(SQL assertions)]
  end
  subgraph ShopLite
    UI[Web UI] --> REST[REST API<br/>Express + TS]
    REST --> PG[(PostgreSQL)]
  end
  E2E --> UI
  API --> REST
  PM --> REST
  DB --> PG
  E2E -. verify persisted data .-> PG
  API -. arrange test data .-> PG
```

## Quick start

Requirements: Node 20+, PostgreSQL 16 (or `docker run -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=shoplite -p 5432:5432 postgres:16`).

```bash
npm ci
npx playwright install chromium
npm run db:reset        # schema + seed data

npm test                # all Playwright projects (starts the app automatically)
npm run test:api        # API only
npm run test:db         # database only
npm run test:e2e        # UI only
npx playwright test --grep @smoke   # smoke subset
npm run report          # open the HTML report

npm start               # run the app → http://localhost:3000
npm run test:postman    # Newman (needs the app running)
```

Seed users (password `Passw0rd!`): `standard@shoplite.test`, `other@shoplite.test`, `locked@shoplite.test`. Coupons: `WELCOME10`, `HALFOFF`, `EXPIRED20` (inactive).

Set `DATABASE_URL` if your Postgres isn't at `postgres://postgres:postgres@localhost:5432/shoplite`.

## Project structure

```
├── src/                     # ShopLite API (Express + TypeScript + pg)
├── public/                  # ShopLite web UI (plain JS)
├── db/                      # schema.sql (with business-rule constraints) + seed.sql
├── tests/
│   ├── api/                 # auth, products, orders: rules, validation, authz, concurrency
│   ├── db/                  # persistence, constraints, data-quality SQL checks
│   ├── e2e/
│   │   ├── pages/           # Page Objects
│   │   ├── fixtures.ts      # page objects injected as fixtures
│   │   └── *.spec.ts        # login, checkout, orders, resilience, accessibility
│   ├── support/             # API client, DB helper, Zod schemas, test data, shared fixtures
│   └── global-setup.ts      # clean database per run
├── postman/                 # collection + environment (Newman in CI)
├── docs/                    # test strategy, manual test cases
└── .github/workflows/ci.yml
```

## Design decisions

- **Log in through the API, not the UI**, for every UI test except the login tests themselves (`loggedInPage` fixture). It saves seconds per test and keeps failures pointing at the feature under test.
- **Each test creates its own data** (`db.createProduct()` with a unique SKU). No shared mutable state, so the suite runs fully parallel and in any order.
- **Arrange via API/DB, act via UI, assert in the DB.** The checkout E2E test reads the order back from PostgreSQL: a UI that says "Order confirmed" isn't proof.
- **Strict schemas** (`.strict()`): if the API starts returning an unexpected field (say, `password_hash`), the contract test fails.
- **The API client returns raw responses.** Tests assert status codes themselves; nothing hides a 500 behind a helper.
- **Network mocking for failure modes** (`page.route`): 500s, slow responses and expired sessions are tested on purpose.
- **Business rules are also database constraints**, and tests prove the database refuses bad data even if the API had a bug.

## Coverage at a glance

| Suite | Tests | Highlights |
|---|---|---|
| API | 54 | boundary values, 400/401/404/409/422/423 paths, IDOR, atomicity, race condition, SQL-injection input |
| DB | 12 | persisted totals, frozen prices, rollback leaves no rows, CHECK/FK/UNIQUE constraints, data-quality queries |
| E2E | 21 × 2 browsers | full checkout with coupon, cart math, stock-out message, double submit, mocked failures, axe a11y |
| Postman | 17 requests / 67 assertions | chained flow, JSON schema, dynamic data selection |

## Author

**David** · QA Engineer (manual + automation) · [LinkedIn](https://www.linkedin.com/in/david-vera-qa)
