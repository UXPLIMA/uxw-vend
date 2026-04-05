# Contributing to uxwVend

## Development Setup

1. Fork and clone the repository.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure database credentials.
4. Push the database schema: `npx prisma db push`
5. Optionally seed demo data: `npm run db:seed`
6. Start the dev server: `npm run dev`

The dev server runs with Turbopack and automatically runs the `predev` script to regenerate theme and module registries.

---

## Module Development Workflow

All new features must be built as modules. See [PLUGIN_SDK.md](PLUGIN_SDK.md) for the full guide.

1. Create a directory in `src/modules/your-module/`.
2. Add a `module.json` manifest.
3. Add pages, API routes, and components.
4. Run `npx tsx scripts/generate-registry.ts` to regenerate the registry.
5. Test with `npm run dev`.
6. Ensure `npm run build` and `npx tsc --noEmit` pass before submitting.

---

## Core Contribution Rules

The core (`src/core/`, `src/app/`) is the platform framework. It provides auth, database, permissions, theming, i18n, and the module system itself.

**NEVER add module-specific code to core.** If a feature is specific to one domain (store, blog, forum, support), it belongs in a module. Core should only contain functionality that all modules need.

Examples of what belongs in core:
- Auth system, session management
- Permission checking utilities
- Database client singleton
- UI component library (Button, Card, Input, etc.)
- Theme system, ThemeSlot component
- i18n configuration and navigation helpers
- Module loader, registry generator
- Rate limiting, activity logging

Examples of what belongs in a module:
- Store product pages and checkout flow
- Blog article editor and categories
- Forum topics and replies
- Support ticket system
- Payment gateway integrations

---

## Coding Conventions

### TypeScript
- Strict mode is enabled. No `any` types -- use proper types or `unknown`.
- Use the `@/` path alias for all imports (resolves to `src/`).
- Validate API inputs with Zod 4. Use `.issues` (not `.errors`) for validation error messages.

### React
- Server components by default. Add `"use client"` only when the component needs hooks, event handlers, or browser APIs.
- Functional components with hooks only (no class components).
- No `confirm()` or `alert()` calls -- use proper UI modals.
- No emoji in code or UI strings.
- Sanitize HTML with DOMPurify before using `dangerouslySetInnerHTML`.

### Routing and i18n
- Use `Link` and `usePathname` from `@/core/lib/i18n/navigation` (not `next/link`) for locale-aware routing in public pages.
- Use `useTranslations()` from `next-intl` for all UI text. No hardcoded strings.
- Translation files are in `/messages/{en,tr,de}.json`.

### API Routes
- REST conventions under `/api/v1/`.
- Auth check: `const session = await auth()`
- Admin check: `await isAdmin(session.user.id)`
- Consistent error format: `{ error: "message" }`
- Use `rateLimit()` on auth-related endpoints.
- Soft delete for products (`isActive = false`), not hard delete.

### CSS
- Tailwind CSS v4 for styling.
- Dark mode uses `data-mode="dark"` attribute on `<html>`.
- Custom CSS overrides go in `globals.css`.

---

## Commit Messages

Format: `<type>: <description>`

Types:
- `feat` -- new feature
- `fix` -- bug fix
- `refactor` -- code restructuring without behavior change
- `docs` -- documentation only
- `style` -- formatting, whitespace, etc.
- `test` -- adding or updating tests
- `chore` -- build scripts, dependencies, config

---

## Pull Request Guidelines

- One feature or fix per PR.
- Include a clear description of what changed and why.
- Ensure `npm run build` passes.
- Ensure `npx tsc --noEmit` passes with no errors.
- If adding a module, include the complete module directory with `module.json`.
- If modifying `module.json` or adding routes, confirm that `npx tsx scripts/generate-registry.ts` succeeds.
- Do not include generated files (`src/core/generated/*`) in the PR if only module source changed -- the CI will regenerate them.
