# Contributing to uxwVend

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure
4. Push database schema: `npx prisma db push`
5. Seed demo data: `npm run db:seed`
6. Start dev server: `npm run dev`

## Code Style

- TypeScript strict mode
- Functional components with hooks
- Server components by default, `"use client"` only when needed
- API validation with Zod
- Use `@/` path alias for imports
- Use i18n `Link` and `useRouter` from `@/core/lib/i18n/navigation` in public pages

## Adding Features

New features should be created as modules. See [Plugin SDK](PLUGIN_SDK.md).

## API Conventions

- REST endpoints in `/api/v1/`
- Auth check: `const session = await auth()`
- Admin check: `await isAdmin(session.user.id)`
- Zod validation on input
- Consistent error format: `{ error: "message" }`

## Commit Messages

Format: `<type>: <description>`

Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

## Pull Requests

- One feature per PR
- Include description of changes
- Ensure `npm run build` passes
- Ensure `npx tsc --noEmit` passes
