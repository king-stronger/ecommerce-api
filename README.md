# Ecommerce API

Pareto ecommerce backend for portfolio demos and future client storefronts.

**Stack:** Cloudflare Workers · Hono · Drizzle · Neon Postgres · Better Auth · OpenAPI/Scalar

## Features

| Area | Routes |
| --- | --- |
| Auth | Better Auth at `/api/auth/*` (email/password + admin plugin) |
| Catalog (public) | Categories & products |
| Cart | Guest cart via `cart_session` cookie |
| Checkout / orders | Place order (no PSP charge), lookup by order number |
| Admin | Categories, products, variants, order status |

Payments table exists for a future PSP; there are **no** payment charge routes by design.

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill `.env` (Neon `DATABASE_URL`, Better Auth secret/URL, trusted frontend origins).

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- API: `http://localhost:8787`
- OpenAPI JSON: `/docs`
- Scalar UI: `/scalar`

### Demo credentials (after seed)

| | |
| --- | --- |
| Email | `admin@example.com` |
| Password | `adminadmin123` |
| Coupon | `WELCOME10` (10% off, min €20) |

Override with `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` in `.env`.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Wrangler local Worker |
| `pnpm deploy` | Deploy Worker |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Idempotent demo data + admin user |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm auth:generate` | Regenerate Better Auth Drizzle schema |

## Frontend notes

- Put the SvelteKit origin in `TRUSTED_ORIGINS` (CORS + Better Auth).
- Call the API with `credentials: "include"` so auth + cart cookies work.
- Guest cart is bound to the `cart_session` cookie set by cart routes.
- Admin OpenAPI routes require a session whose user `role` includes `admin`.

## Env

See [`.env.example`](./.env.example). Local secrets live in `.env` only (Wrangler reads it for `wrangler dev`).
