# Project Working Rules

## Architecture
- Fastify is the only backend business logic layer.
- Next.js must not become a second backend.
- Prisma access belongs to backend/domain layer, not arbitrary web actions.

## Package manager
- Use pnpm only.

## Quality gates
- Run check:tailwind, lint, typecheck, and build after each milestone.
- Do not leave the repo in a failing state.
- Do not introduce any TailwindCSS warnings.
- If check:tailwind reports any warning, fix it to zero before finishing.
- Follow TailwindCSS best practices (utility-first, avoid inline styles, avoid conflicting/duplicated classes, and keep class usage consistent and maintainable).

## Scope control
- Do not add extra infra or services unless required by the checklist/execution plan.

## UI implementation rules
- Page UI must be implemented as a 1:1 reproduction of the specified `.pen` file.
- Do not introduce unrelated visual elements, layout changes, styles, or interactions that are not present in the specified `.pen` file unless explicitly requested.

## Auth rules
- Use JWT access tokens.
- Use refresh token rotation.
- Store only hashed refresh tokens.
- Prefer secure, httpOnly cookie strategy for refresh tokens.
