# Project Working Rules

## Architecture
- Fastify is the only backend business logic layer.
- Next.js must not become a second backend.
- Prisma access belongs to backend/domain layer, not arbitrary web actions.

## Package manager
- Use pnpm only.

## Quality gates
- Run lint, typecheck, and build after each milestone.
- Do not leave the repo in a failing state.

## Scope control
- Do not add extra infra or services unless required by the checklist/execution plan.

## Auth rules
- Use JWT access tokens.
- Use refresh token rotation.
- Store only hashed refresh tokens.
- Prefer secure, httpOnly cookie strategy for refresh tokens.