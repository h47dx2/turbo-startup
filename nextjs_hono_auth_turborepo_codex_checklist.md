
# Next.js + Hono + Turborepo Auth Stack (Codex Checklist)

Goal: Build a monorepo project using Turborepo with:
- Next.js (App Router)
- Hono API server
- Prisma ORM
- Supabase PostgreSQL
- Zod validation
- JWT Access Token + Refresh Token authentication

Principles:
- Hono = single source of backend business logic
- Next.js = UI / SSR / Server Components / thin Server Actions
- Shared validation schemas via Zod
- Refresh token rotation with hashed storage

---

## 1. Initialize Monorepo

- Initialize repository
- Install pnpm
- Initialize Turborepo
- Configure workspace

Structure:

apps/
  web (Next.js)
  api (Hono)

packages/
  database (Prisma)
  schemas (Zod)
  api-client (typed fetch client)

---

## 2. Setup Next.js App

- Use latest Next.js App Router
- Configure TypeScript
- Install dependencies:
  - react
  - next
  - zod

---

## 3. Setup Hono API

- Create Hono server (Node runtime)
- Install dependencies:
  - `hono`
  - `@hono/node-server`
  - `@hono/zod-validator`
  - `zod`
- Use built-in middleware/helper import paths (not separate npm packages):
  - `hono/cors`
  - `hono/jwt`
  - `hono/cookie`
  - `hono/csrf`
  - `hono/secure-headers`

---

## 4. Setup Prisma

- Create Prisma schema
- Connect to Supabase PostgreSQL
- Create models:

User
RefreshToken

- Run migration
- Generate client

---

## 5. Auth System

### Register
- validate input (Zod)
- hash password (argon2)
- store user

### Login
- verify password
- issue access token (short lifetime)
- create refresh token
- store hashed refresh token

### Refresh
- verify refresh token
- rotate refresh token
- issue new access token

### Logout
- revoke refresh token

---

## 6. Shared Zod Schemas

Move validation schemas into `packages/schemas`

Examples:
- loginSchema
- registerSchema
- refreshSchema

---

## 7. API Client

Create typed API client used by Next.js

Responsibilities:
- attach access token
- handle refresh automatically

---

## 8. Next.js Auth Integration

- Login form
- Register form
- Store access token in memory
- Store refresh token in httpOnly cookie

Server Actions call Hono endpoints.

---

## 9. Security

- Argon2 password hashing
- httpOnly refresh cookie
- short-lived access tokens
- refresh token rotation
