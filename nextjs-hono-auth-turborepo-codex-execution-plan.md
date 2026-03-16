# Next.js + Hono + Turborepo + Supabase(Postgres) + Prisma + Zod + JWT(Auth)  
# Codex Execution Plan (Phased)

> Goal: build a production-oriented monorepo where **Hono is the only business backend**, **Next.js is the web app / BFF / SSR layer**, and auth is implemented with **JWT access token + refresh token rotation**.  
> This document is for **Codex execution**. Execute phase by phase. Do not skip validation gates.
>
> Framework migration note: this plan is also the execution baseline for migrating an existing `apps/api` from Fastify to Hono with no auth/security regressions.

---

## 0. Core architectural rules (must follow before any coding)

- Use **latest stable versions** of all dependencies at execution time.
- Verify versions against **official docs** before installing.
- Use **pnpm workspaces** + **Turborepo**.
- Use **TypeScript** everywhere.
- Use **Hono** as the single backend truth for:
  - auth
  - user domain logic
  - token issuing / rotation / revocation
  - Prisma DB writes
  - input validation and API contracts
- Use **Next.js App Router** for:
  - UI
  - Server Components
  - thin Server Actions / route handlers only when needed as web adapters
  - reading session cookies
  - calling Hono APIs from the server side
- Do **not** put core auth business logic in Next.js.
- Do **not** let Next.js directly become a second backend.
- Use **Prisma** as the ORM.
- Use **Zod** for input validation and shared schema definitions.
- Use **Supabase Postgres** as the database only; do not use Supabase Auth for this project.
- Use **HTTP-only cookies** for refresh token on web.
- Keep access token short-lived and refresh token rotatable.
- Use **hashed refresh tokens in DB**, never store raw refresh tokens.
- Prefer **Argon2id** for password hashing.

Version snapshot (checked on **March 16, 2026** via npm registry metadata):

- `hono`: `4.12.8`
- `@hono/node-server`: `1.19.11`
- `@hono/zod-validator`: `0.7.6`

---

## 1. Target monorepo shape

Create the repository to match this structure:

```text
.
├─ apps/
│  ├─ web/                  # Next.js App Router app
│  └─ api/                  # Hono API server
├─ packages/
│  ├─ database/             # Prisma schema, generated client, db helpers
│  ├─ auth/                 # token helpers, password hashing, auth domain utils
│  ├─ validation/           # shared zod schemas and DTOs
│  ├─ api-client/           # typed fetch client used by web to call api
│  ├─ config/               # shared tsconfig/eslint/prettier/env helpers if needed
│  └─ types/                # shared public types if needed
├─ turbo.json
├─ pnpm-workspace.yaml
├─ package.json
└─ .env.example
```

Rules:

- `apps/api` owns all auth routes and business logic.
- `apps/web` never imports Prisma directly for auth flows.
- `packages/database` is consumed by `apps/api`, not by `apps/web` for core auth operations.
- `packages/validation` contains shared Zod schemas used on both sides.
- `packages/api-client` contains typed wrappers for calling Hono from Next.js.

---

## 1.5 Fastify -> Hono migration scope

Migration objective:

- replace Fastify runtime and plugin layer in `apps/api` with Hono on Node runtime
- preserve existing auth contract (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`)
- preserve JWT access + refresh rotation behavior and DB model semantics
- preserve cookie/CSRF/CORS security posture

Recommended migration order:

1. Introduce Hono app entry (`app.ts` + `server.ts`) behind feature branch.
2. Port cross-cutting middleware first (CORS, cookies, security headers, csrf).
3. Port health/readiness routes.
4. Port auth routes and handlers one by one with unchanged request/response contracts.
5. Keep shared Zod contracts and API client stable; only swap server adapter layer.
6. Run full quality gates and auth regression tests before removing Fastify-specific code.

---

## 2. Phase map

Execute in this order only:

1. Phase A — Workspace bootstrap
2. Phase B — Shared packages foundation
3. Phase C — Prisma + Supabase Postgres setup
4. Phase D — Hono API foundation
5. Phase E — Auth domain implementation
6. Phase F — Next.js app foundation
7. Phase G — Web auth integration
8. Phase H — Security hardening
9. Phase I — Testing
10. Phase J — DX / scripts / CI readiness
11. Phase K — Final validation and documentation

At the end of each phase, complete the phase checklist before moving on.

---

# Phase A — Workspace bootstrap

## A1. Initialize repo

- Create root workspace using `pnpm`.
- Create root `package.json`.
- Create `pnpm-workspace.yaml`.
- Create `turbo.json`.
- Set Node version to a currently supported version compatible with latest:
  - Next.js
  - Hono (current stable major at execution time)
  - Prisma
- Prefer current stable Node LTS or current stable recommended by official docs at execution time.

## A2. Initialize apps

- Create `apps/web` with latest stable **Next.js App Router** template using TypeScript.
- Create `apps/api` as a standalone Hono TypeScript app.

## A3. Initialize shared packages

Create packages:

- `packages/database`
- `packages/auth`
- `packages/validation`
- `packages/api-client`
- `packages/config`
- `packages/types`

## A4. Root tooling

Add and configure latest stable official tooling where appropriate:

- TypeScript
- ESLint
- Prettier (optional but recommended)
- Turbo
- dotenv / env validation strategy if needed

## A5. Root scripts

Add workspace scripts such as:

- dev
- build
- lint
- typecheck
- test
- format
- db:generate
- db:migrate
- db:studio

## Phase A checklist

- [ ] Monorepo boots with pnpm workspace.
- [ ] `turbo run build` works with placeholder apps/packages.
- [ ] `turbo run typecheck` works.
- [ ] `apps/web` runs.
- [ ] `apps/api` runs.

---

# Phase B — Shared packages foundation

## B1. `packages/validation`

Create shared Zod modules for:

- register input
- login input
- refresh input / refresh cookie contract
- logout input
- user public DTO
- auth response DTOs
- generic error DTO

Keep schemas framework-agnostic.

## B2. `packages/types`

Add shared types only when derived from schemas or stable contracts.
Prefer deriving from Zod with `z.infer`.

## B3. `packages/auth`

Create placeholders for:

- password hashing
- password verification
- JWT access token signing
- JWT access token verification
- refresh token generation
- refresh token hashing
- session / token payload types
- auth constants (TTL, cookie names, issuer, audience)

## B4. `packages/api-client`

Create a typed fetch wrapper for the web app to call the API.
Include:

- base URL support
- JSON request helper
- typed error normalization
- cookie forwarding support for server-side calls from Next.js
- optional bearer token support for internal server calls

## B5. `packages/config`

Create shared config for:

- tsconfig base
- eslint base
- maybe env parsing helpers

## Phase B checklist

- [ ] Shared Zod schemas compile.
- [ ] Shared packages build independently.
- [ ] Web and API can import shared packages successfully.

---

# Phase C — Prisma + Supabase Postgres setup

## C1. Prisma package setup

Inside `packages/database`:

- initialize Prisma using the latest official setup flow
- use the latest recommended Prisma client generator from official docs
- generate client into this package, not ad hoc into app-local hidden directories
- configure Postgres datasource

## C2. Environment design

Define environment variables:

- `DATABASE_URL`
- `DIRECT_URL` if needed by Prisma / migrations
- `SHADOW_DATABASE_URL` only if needed
- auth secrets
- API / web public URLs

Create `.env.example` with placeholders and comments.

## C3. Prisma schema

Create minimum models:

### `User`
Fields should include at least:

- `id`
- `email` (unique)
- `username` or optional display name if desired
- `passwordHash`
- `createdAt`
- `updatedAt`

### `RefreshToken`
Fields should include at least:

- `id`
- `userId`
- `tokenHash`
- `family`
- `parentTokenId` (nullable)
- `issuedAt`
- `expiresAt`
- `revokedAt` (nullable)
- `replacedByTokenId` (nullable)
- `userAgent` (nullable)
- `ipAddress` (nullable)
- `createdAt`

Purpose:

- support refresh token rotation
- support token family revocation on replay detection
- support logout / logout-all flows later

### Optional helper model(s)

If useful, add:

- `AuthAuditLog` or equivalent lightweight table

But keep MVP focused.

## C4. Migration

- create initial migration
- apply migration to Supabase Postgres
- verify tables on Supabase

## C5. Prisma helpers

Create:

- Prisma singleton / client factory suitable for monorepo and dev hot reload
- DB helper exports in `packages/database`

## C6. Seeding (optional but recommended)

- add a seed script for a test user only if safe and clearly marked non-production

## Phase C checklist

- [ ] Prisma client generates successfully.
- [ ] Migration applies successfully to Supabase Postgres.
- [ ] DB connection works from API app.
- [ ] User and RefreshToken models are queryable.

---

# Phase D — Hono API foundation

## D1. Initialize Hono app with official Node adapter + middleware

Set up latest stable Hono with:

- `hono` + `@hono/node-server`
- sensible logging strategy (`hono/logger`)
- CORS configured narrowly for the web origin (`hono/cors`)
- cookie helpers (`hono/cookie`)
- security headers (`hono/secure-headers`)
- CSRF middleware/strategy (`hono/csrf`) for cookie-auth mutations
- health route

Important:

- compose middleware in a stable top-down order (request id -> logging -> security -> auth helpers -> routes)
- keep middleware/route registration modular (`app.route('/auth', authRoute)`)

## D2. Hono app structure

Use a clear structure such as:

```text
apps/api/src/
├─ app.ts
├─ server.ts
├─ middleware/
├─ routes/
│  └─ auth/
├─ modules/
│  └─ auth/
├─ lib/
├─ config/
└─ types/
```

## D3. Route contract strategy

Use Zod-based validation strategy consistently.
You may use:

- shared Zod schemas with `@hono/zod-validator`, or
- OpenAPI-first contracts with `@hono/zod-openapi` if API docs-first is preferred

Pick one coherent strategy and use it everywhere.

## D4. Base routes

Implement:

- `GET /health`
- `GET /ready`

## D5. Error handling

Implement centralized API error normalization:

- validation errors
- auth errors
- domain errors
- unexpected errors

Output stable JSON shape.

## Phase D checklist

- [ ] Hono boots locally.
- [ ] Health route works.
- [ ] Validation and error handling are wired.
- [ ] Shared schemas can be consumed in routes.

---

# Phase E — Auth domain implementation

## E1. Password hashing

Implement with Argon2id.

Requirements:

- use current best-practice parameters from official library / security guidance at execution time
- wrap hashing in reusable functions
- wrap verification in reusable functions

## E2. JWT design

Implement access tokens with claims such as:

- `sub` = user id
- `email` if needed
- `type` = `access`
- `sessionVersion` only if you decide to support global invalidation later
- standard issuer / audience where useful

Requirements:

- short TTL, e.g. around 10–15 minutes unless a better explicit project decision is made
- signed with strong secret
- no refresh token data in access token payload

## E3. Refresh token design

Requirements:

- refresh token must be opaque random string, not a JWT
- store only the hash in DB
- set expiry (e.g. around 30 days, configurable)
- store token family metadata for rotation

## E4. Register flow

Implement `POST /auth/register`:

- validate input with Zod
- normalize email
- enforce unique email
- hash password
- create user
- create initial refresh token record
- issue access token
- set refresh token cookie for web-compatible flow
- return minimal public user payload + access token response body

## E5. Login flow

Implement `POST /auth/login`:

- validate input
- fetch user by email
- verify password
- create new refresh token record
- issue new access token
- set refresh token cookie
- return public user payload + access token

## E6. Refresh flow

Implement `POST /auth/refresh`:

- read refresh token from cookie (web flow) and optionally body/header for non-browser clients if you choose to support both
- hash incoming token
- find matching active token record
- verify not expired / revoked
- rotate token:
  - revoke current token
  - create replacement token in same family
  - link parent/replacement ids
- issue new access token
- set new refresh token cookie
- return new access token + public user

## E7. Replay detection

Implement refresh token replay protection:

- if a revoked token in a family is reused, revoke the entire token family
- force re-login when replay is detected

## E8. Logout flow

Implement `POST /auth/logout`:

- revoke current refresh token if present
- clear refresh cookie
- return success

## E9. Me flow

Implement `GET /auth/me`:

- authenticate using access token
- return current user public profile

## E10. Auth guard

Implement reusable auth pre-handler / middleware for protected routes:

- parse bearer token
- verify JWT
- attach auth user to request context

## E11. Optional logout-all flow

If time permits, implement:

- `POST /auth/logout-all`
- revoke all active refresh tokens for current user

## Phase E checklist

- [ ] Register works.
- [ ] Login works.
- [ ] Refresh rotation works.
- [ ] Logout works.
- [ ] `/auth/me` works with access token.
- [ ] Replay detection path is implemented.
- [ ] Refresh tokens are hashed in DB.
- [ ] Raw refresh tokens are never persisted.

---

# Phase F — Next.js app foundation

## F1. Clean web architecture

In `apps/web`, follow these rules:

- App Router only
- Server Components by default
- Client Components only where interactivity is needed
- no Prisma access for auth flow
- all auth communication goes through API client to Hono

## F2. Web structure

Use a clean structure such as:

```text
apps/web/
├─ app/
│  ├─ (public)/
│  │  ├─ login/
│  │  └─ register/
│  ├─ (protected)/
│  │  └─ dashboard/
│  ├─ api/               # only thin adapters when necessary
│  └─ layout.tsx
├─ components/
├─ lib/
│  ├─ auth/
│  ├─ api/
│  └─ env/
└─ middleware.ts or proxy equivalent if required by current Next docs
```

## F3. Session helper strategy

Create web-side helpers for:

- reading access token from secure storage strategy chosen for web
- reading refresh cookie indirectly through server calls
- calling Hono refresh endpoint from the server side when needed

Important architecture note:

- web should prefer server-side API calls for authenticated page rendering
- avoid exposing unnecessary auth complexity to the browser

## F4. Public pages

Create pages:

- `/login`
- `/register`

## F5. Protected page

Create a sample protected page:

- `/dashboard`

Behavior:

- if not authenticated, redirect to `/login`
- if authenticated, fetch current user via API and render a minimal dashboard

## Phase F checklist

- [ ] Web app runs.
- [ ] Public pages render.
- [ ] Protected route pattern is in place.
- [ ] API client can call Hono from the server side.

---

# Phase G — Web auth integration

## G1. Registration form

Implement register page with:

- form validation on client using shared Zod schema where appropriate
- submit to a thin Next.js Server Action or route adapter, or directly to Hono from the browser only if justified
- preferred approach: use a thin server-side adapter for better cookie handling and cleaner architecture

On success:

- establish authenticated web session strategy
- redirect to dashboard

## G2. Login form

Implement login page similarly.

On success:

- persist access token in the chosen secure web strategy
- rely on HTTP-only refresh cookie for refresh flow

## G3. Access token handling strategy

Implement one clear strategy and document it in code comments.
Recommended web approach:

- short-lived access token stored in secure server-managed cookie or equivalent web session mechanism under your control
- refresh token stored separately as HTTP-only cookie from API domain / same-site strategy

Do not create an incoherent hybrid.

## G4. Auth refresh bridge

Implement server-side refresh logic for web requests:

- when access token is expired for a protected server-side fetch, attempt refresh once
- if refresh succeeds, retry original request
- if refresh fails, clear session state and redirect to login

## G5. Logout button

Implement logout action:

- call Hono logout endpoint
- clear local access/session state
- redirect to login

## G6. Current user fetch

Implement shared helper for web:

- get current user on the server using current access token
- optionally auto-refresh once when expired

## Phase G checklist

- [ ] Register page creates real account.
- [ ] Login page authenticates real account.
- [ ] Dashboard can read authenticated user.
- [ ] Expired access token can be refreshed once automatically.
- [ ] Logout clears session and cookies correctly.

---

# Phase H — Security hardening

## H1. Cookie policy

Set refresh cookie with appropriate flags:

- `httpOnly`
- `secure` in production
- `sameSite` chosen deliberately based on deployment topology
- scoped path if desired
- maxAge aligned with refresh expiry

Document same-origin vs subdomain deployment assumptions.

## H2. CSRF strategy

Because refresh/logout can be cookie-based, add a CSRF strategy appropriate to architecture.
Choose one explicit strategy, for example:

- same-site strict/lax with same-origin deployment constraints, plus origin checks
- or explicit CSRF token for cookie-authenticated mutation routes

Implement and document the chosen approach.

## H3. Rate limiting

Add auth route protections:

- login rate limit
- register rate limit
- refresh rate limit

## H4. Input normalization

- lower-case emails
- trim strings
- enforce password rules via schema

## H5. Secrets management

Use env validation for:

- JWT secret(s)
- cookie secret if needed
- database URLs
- app URLs

Fail fast on boot if missing.

## H6. CORS

- allow only the web origin
- avoid wildcard in production
- handle credentials correctly

## H7. Proxy / trusted headers

If deployed behind proxy:

- configure trust proxy deliberately
- document expectations for secure cookies and IP logging

## Phase H checklist

- [ ] Secure cookie flags configured.
- [ ] CSRF strategy implemented.
- [ ] Rate limiting added.
- [ ] Env validation fails fast.
- [ ] CORS is narrow.

---

# Phase I — Testing

## I1. Unit tests

Add unit tests for:

- password hashing and verification
- JWT sign/verify
- refresh token hash/compare
- auth domain helpers

## I2. Integration tests for API

Add integration tests covering:

- register
- login
- me
- refresh rotation
- logout
- replay detection

Use isolated test database strategy where possible.

## I3. Web smoke tests

At minimum, verify:

- login page renders
- register page renders
- protected dashboard redirects when logged out
- dashboard renders when logged in

## Phase I checklist

- [ ] Auth domain unit tests pass.
- [ ] API integration tests pass.
- [ ] Web auth smoke path is verified.

---

# Phase J — DX / scripts / CI readiness

## J1. Scripts

Ensure root scripts exist and work:

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:studio`

## J2. Dev environment

Make local dev easy:

- one command to run web + api
- clear README notes for env setup

## J3. Docker readiness (optional but recommended)

Prepare for future containerization:

- avoid app-local fragile absolute paths
- make generated Prisma client paths deterministic
- keep env expectations explicit

## J4. CI readiness

Prepare project so CI can later do:

- install
- prisma generate
- typecheck
- lint
- test
- build

## Phase J checklist

- [ ] Root scripts work.
- [ ] Fresh clone setup is straightforward.
- [ ] Build is reproducible.

---

# Phase K — Final validation and documentation

## K1. End-to-end acceptance test

Manually verify this exact flow:

1. start api + web
2. create new user on register page
3. land on dashboard authenticated
4. logout
5. login again
6. visit protected page successfully
7. expire access token or simulate expiry
8. refresh flow succeeds without full login
9. logout
10. protected page redirects to login

## K2. DB validation

Verify in database:

- user record created
- password is hashed
- refresh token row exists
- token hash only, not raw token
- rotation creates replacement rows correctly
- revoked rows are marked correctly

## K3. Codebase validation

Ensure:

- no core auth logic duplicated in Next.js and Hono
- no Prisma access from Next.js auth flow
- shared Zod schemas are reused
- no secrets committed

## K4. README

Write concise setup instructions covering:

- required env vars
- local dev commands
- migration commands
- architecture note: Hono is the auth/backend truth, Next.js is UI/BFF

## Final completion checklist

- [ ] Monorepo created successfully.
- [ ] Latest stable deps used at execution time.
- [ ] Versions checked against official docs.
- [ ] Next.js App Router web app works.
- [ ] Hono API works.
- [ ] Prisma works with Supabase Postgres.
- [ ] Zod validation is shared.
- [ ] JWT access token works.
- [ ] Refresh token rotation works.
- [ ] Refresh token replay detection works.
- [ ] Login / register / me / refresh / logout all work.
- [ ] Protected page flow works in web app.
- [ ] Security basics are implemented.
- [ ] Tests pass.
- [ ] README exists.

---

# Implementation notes Codex must respect

## Dependency policy

- Always install latest stable versions at execution time.
- Before installation, verify each important package via official docs / package metadata.
- Do not pin to outdated examples from memory.

Important packages to verify against official docs before install include:

- next
- react
- react-dom
- hono
- `@hono/node-server`
- `@hono/zod-validator`
- prisma
- `@prisma/client`
- zod
- argon2
- jsonwebtoken or a more modern officially maintained JWT library if better justified at execution time
- any additional Hono package used (`@hono/swagger-ui`, `@hono/zod-openapi`, etc.)
- turbo
- typescript

## Architectural red lines

- Do not use NextAuth / Auth.js for this project.
- Do not use Supabase Auth for this project.
- Do not let Next.js directly own user/password/refresh-token writes.
- Do not store raw refresh tokens in DB.
- Do not make refresh tokens JWTs.
- Do not use localStorage for refresh tokens.

## Preferred quality bar

- clean folder structure
- minimal but production-oriented auth implementation
- explicit error handling
- clear naming
- zero dead scaffolding
- comments only where they carry architectural value

---

# Suggested first execution command for Codex

Start with Phase A only.  
Do not implement auth yet.  
Bootstrap the workspace, apps, shared packages, root scripts, and base TypeScript/tooling.  
After Phase A is complete, validate all checklist items before proceeding to Phase B.
