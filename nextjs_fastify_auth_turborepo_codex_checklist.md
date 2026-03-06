
# Next.js + Fastify + Turborepo Auth Stack (Codex Checklist)

Goal: Build a monorepo project using Turborepo with:
- Next.js (App Router)
- Fastify API server
- Prisma ORM
- Supabase PostgreSQL
- Zod validation
- JWT Access Token + Refresh Token authentication

Principles:
- Fastify = single source of backend business logic
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
  api (Fastify)

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

## 3. Setup Fastify API

- Create Fastify server
- Install dependencies:
  - fastify
  - @fastify/cors
  - @fastify/jwt
  - @fastify/cookie
  - zod

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

Server Actions call Fastify endpoints.

---

## 9. Security

- Argon2 password hashing
- httpOnly refresh cookie
- short-lived access tokens
- refresh token rotation
