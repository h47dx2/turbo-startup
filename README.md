# Turbo Startup Auth Foundation

Production-oriented auth foundation in a Turborepo monorepo:

- `apps/web`: Next.js App Router UI + thin BFF adapters
- `apps/api`: Hono backend (single business-logic source of truth)
- `packages/database`: Prisma + Supabase Postgres integration
- `packages/auth`: password/JWT/refresh token helpers
- `packages/validation`: shared Zod contracts
- `packages/api-client`: typed fetch client

## Architecture rules

- Hono owns auth/domain logic and DB writes.
- Next.js is UI/BFF only.
- Refresh tokens are opaque random strings.
- Only hashed refresh tokens are stored in DB.
- Access tokens are short-lived JWTs.

## Requirements

- Node.js `>=24`
- pnpm `10.x`
- Supabase Postgres project

## Backend framework baseline

- Backend framework is Hono (Node runtime).
- Version snapshot (checked on March 16, 2026):
  - `hono`: `4.12.8`
  - `@hono/node-server`: `1.19.11`
  - `@hono/zod-validator`: `0.7.6`
- Install backend deps using latest stable packages at execution time:
  - `hono@latest`
  - `@hono/node-server@latest`
  - `@hono/zod-validator@latest`
- Use Hono built-in middleware/helper imports (not separate npm packages):
  - `hono/cors`
  - `hono/cookie`
  - `hono/jwt`
  - `hono/csrf`
  - `hono/secure-headers`
- Before each migration milestone, re-check latest versions with:
  - `pnpm view hono version`
  - `pnpm view @hono/node-server version`
  - `pnpm view @hono/zod-validator version`

## Environment variables

Copy `.env.example` to `.env` and set:

- `DATABASE_URL`
- `DIRECT_URL`
- `API_BASE_URL`
- `ALLOWED_WEB_ORIGIN`
- `JWT_ACCESS_SECRET`
- `REFRESH_TOKEN_PEPPER`
- `CSRF_TOKEN_SECRET`
- `MOBILE_AUTH_SHARED_SECRET` (required only for mobile mode)
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_SECONDS`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `REFRESH_COOKIE_NAME`
- `REFRESH_COOKIE_SAME_SITE`
- `CSRF_COOKIE_NAME`
- `TRUST_PROXY`

## Install

```bash
pnpm install
```

## Database

Generate Prisma client:

```bash
pnpm db:generate
```

Apply migrations:

```bash
pnpm --filter @repo/database exec prisma migrate deploy
```

## Development

Run all apps/packages in dev mode:

```bash
pnpm dev
```

Or run individually:

```bash
pnpm --filter @repo/api dev
pnpm --filter @repo/web dev
```

## Deployment (Same-Origin Gateway)

For production, prefer a same-origin gateway setup to avoid browser CORS complexity:

- `https://app.example.com/` -> Next.js (`apps/web`)
- `https://app.example.com/api/*` -> Hono (`apps/api`)

With this layout, browser requests stay same-origin from the user's perspective.

Example Nginx routing:

```nginx
server {
  listen 443 ssl;
  server_name app.example.com;

  location /api/ {
    proxy_pass http://api:4000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://web:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Recommended env values in this mode:

- `NODE_ENV=production` (web + api)
- `TRUST_PROXY=true` (api, behind gateway)
- `ALLOWED_WEB_ORIGIN=https://app.example.com` (api CORS origin)
- `API_BASE_URL=https://app.example.com/api` (web BFF -> api through gateway)

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Tests

Run all tests:

```bash
pnpm test
```

Run web smoke only:

```bash
pnpm test:web-smoke
```

Run browser-level XSS regression (Playwright):

```bash
pnpm --filter @repo/web exec playwright install chromium
pnpm test:web-e2e
```

## Auth API

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/csrf`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Mobile mode:

- Configure `MOBILE_AUTH_SHARED_SECRET` in API env
- Send headers `x-auth-mode: mobile` and `x-mobile-auth-secret: <MOBILE_AUTH_SHARED_SECRET>` on `register/login/refresh`
- Response body will include `refreshToken` (in addition to cookie rotation behavior)

CSRF token policy:

- Web cookie flow uses double-submit CSRF tokens.
- `GET /auth/csrf` issues `{ csrfToken }` and `csrf_token` cookie.
- `POST /auth/refresh` and `POST /auth/logout` require `x-csrf-token` for web mode.
- Mobile mode (`x-auth-mode: mobile`) is exempt and sends refresh token in request/response body.

Health:

- `GET /health`
- `GET /ready`

OpenAPI docs:

- `GET /docs` (development/test only)
