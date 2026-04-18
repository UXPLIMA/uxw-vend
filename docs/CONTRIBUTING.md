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

Three directories work together:

| Directory                    | Role                                                           | Git status |
|------------------------------|----------------------------------------------------------------|------------|
| `module-sources/<id>/`       | Authoritative source for first-party modules                   | Tracked    |
| `module-marketplace/<id>.zip`| Distributable artifact the admin marketplace installs from     | Tracked    |
| `src/modules/<id>/`          | Runtime install state — what's currently installed locally     | Ignored    |

Steps for a new first-party module:

1. Create `module-sources/your-module/` with a `module.json` manifest, pages, API routes, and components.
2. Run `npm run build:marketplace` to build `module-marketplace/your-module.zip` and update `module-marketplace/index.json`.
3. Install it locally through the admin marketplace UI (or copy it into `src/modules/` for quick testing).
4. Run `npx tsx scripts/generate-registry.ts` to regenerate the module registry.
5. Commit both `module-sources/your-module/` and `module-marketplace/your-module.zip` (+ `index.json`) in the same commit. Never commit anything under `src/modules/`.
6. Ensure `npm run build`, `npx tsc --noEmit`, and `npm test` pass before submitting.

Editing an existing first-party module follows the same flow: change `module-sources/<id>/`, rebuild ZIPs, commit source + ZIP together.

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
- Active locales: `en` and `tr`. Translations live in the `Translation` DB table; the seed source is `messages-core/<locale>.json`.

### API Routes
- REST conventions under `/api/v1/`.
- Auth check: `const session = await auth()`
- Admin check: `await isAdmin(session.user.id)`
- New endpoints: use `apiSuccess` / `apiError` / `apiPaginated` from `@/core/lib/api-utils` — the canonical envelope is `{ ok: true, data }` or `{ ok: false, error, code? }`. Legacy `{ error }` shapes still exist and are being migrated.
- State-changing endpoints (`POST/PUT/DELETE/PATCH`) must pass the proxy-level CSRF check; they do automatically as long as the browser sends the request. Server-to-server callers set `x-internal-request: $CSRF_INTERNAL_SECRET`.
- Admin mutations should log to `ActivityLog` via `logActivity({ userId, action, entity, entityId, metadata })`.
- Session cookies (configured in `src/core/lib/auth.ts`): `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `secure` only in production. Production uses the `__Secure-` prefix for the session/callback cookies and the stricter `__Host-` prefix for the CSRF cookie. Do not weaken these attributes without a code-review note.
- JWT `updateAge` is 1 hour — role, ban, and revocation changes reach dormant sessions within that window.
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

## Authoring a Theme

Themes live in `src/themes/<id>/`. Each theme is a `theme.json` manifest plus optional React templates.

### Minimal manifest

```json
{
  "schemaVersion": 1,
  "id": "my-theme",
  "name": "My Theme",
  "description": "Short one-line description",
  "version": "1.0.0",
  "author": "You",
  "type": "light",
  "tokens": {
    "colors": {
      "primary":    { "type": "color", "default": "#2563eb" },
      "background": { "type": "color", "default": "#ffffff" }
    }
  },
  "config": {
    "hero": {
      "label": "Hero",
      "fields": {
        "headline": { "type": "text", "default": "Welcome", "max": 100 }
      }
    }
  }
}
```

### Reading config at runtime

```tsx
import { useThemeConfig } from "@/core/lib/theme-config-client";

const cfg = useThemeConfig();
<h1>{cfg("hero.headline", "Welcome")}</h1>
```

### Inheriting from a parent theme

Set `parent: "flat"` in `theme.json`. Tokens and config groups your theme omits fall through to the parent. Two levels max — grandchildren are rejected at schema validation.

### Named slots

Use `<Slot name="home.afterHero">` to render whatever modules have contributed there. See `CANONICAL_SLOTS` in `src/core/lib/slot-registry.ts` for the reserved names.

### Distribution

Zip the `<id>/` folder and upload via Admin → Appearance → Themes → Upload. The upload route validates the manifest, runs the ZIP integrity check, computes a SHA-256 of the manifest (audit trail), and regenerates the theme registry.

The active theme is picked by the `active_theme` setting. Customization (admin overrides) lives in the `ThemeCustomization` table, one row per theme, stored as a diff against the manifest defaults.
