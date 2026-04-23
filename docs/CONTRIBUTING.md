# Contributing to uxwVend

## Core Principle

**Core knows nothing about any module.** No module names, no module paths, no module-specific code belongs in `src/core/` or `src/app/`. Everything is registry-driven from module manifests. When a module is not installed, zero traces exist anywhere in the codebase.

If you are adding a domain feature (store, forum, blog, support tickets, analytics), it belongs in a module, not in core.

---

## Development Setup

### Prerequisites

- Node.js 24+ (enforced by `engines` in `package.json`)
- PostgreSQL 14+
- Git

### First-time setup

```bash
git clone https://github.com/siracozmen01/uxwVend.git
cd uxwVend
npm install
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL, AUTH_SECRET, AUTH_URL
```

Push the schema and seed core data:

```bash
npm run db:merge     # merge core + module schemas into prisma/schema.prisma
npm run db:push      # push merged schema to the database
npm run db:seed      # creates 3 roles + core permissions + admin user
```

Start the dev server:

```bash
npm run dev
```

Turbopack starts on `http://localhost:3001`. The `predev` hook runs automatically and runs `merge-schemas → generate-themes → generate-registry` before the server starts. You do not need to run these manually on startup.

Seed default locale data:

```bash
npx tsx scripts/seed-translations.ts
```

Default admin credentials (change immediately): `admin@example.com` / `password123`.

---

## Directory Structure

```
src/
  core/           — platform framework (auth, RBAC, i18n, DB, rate limiting, module system)
  app/            — Next.js App Router pages (all under [locale]/)
  modules/        — RUNTIME install state (gitignored; populated by the admin UI or dev workflow)
  themes/         — installed themes (flat/ and pixelcraft/ ship in-tree)

module-sources/   — authoritative source for 41 first-party modules (tracked in git)
module-marketplace/ — distributable ZIPs (tracked in git)
scripts/          — code-gen, migrations, backup, marketplace tooling
prisma/           — schema.core.prisma (core models) + seed.ts
```

`src/modules/` is gitignored. It is the runtime install state. Fresh clones start empty. The CI seeds it from `module-sources/` so the type-checker sees all module-contributed Prisma models.

---

## Module Development Workflow

All feature work goes into a module, never into core. See [PLUGIN_SDK.md](PLUGIN_SDK.md) for the full SDK reference.

### Directory trio

| Directory | Role | Git status |
|---|---|---|
| `module-sources/<id>/` | Authoritative source for first-party modules | Tracked |
| `module-marketplace/<id>.zip` | Distributable artifact installed by the marketplace UI | Tracked |
| `src/modules/<id>/` | Runtime install state — what is live locally right now | **Gitignored** |

### Creating a new module

1. Create `module-sources/your-module/` with a `module.json` manifest and your pages, API routes, and components. Run `npm run create:module` for a guided scaffold.
2. Build the marketplace artifact:
   ```bash
   npm run build:marketplace
   ```
   This creates `module-marketplace/your-module.zip` and updates `module-marketplace/index.json`.
3. Install the module through the admin marketplace UI, or copy `module-sources/your-module/` to `src/modules/your-module/` for quick local testing.
4. Regenerate the registry:
   ```bash
   npx tsx scripts/generate-registry.ts
   ```
5. Validate the manifest:
   ```bash
   npm run validate:module -- your-module
   ```
6. Commit both `module-sources/your-module/` and `module-marketplace/your-module.zip` plus the updated `module-marketplace/index.json` in the same commit. Never commit anything under `src/modules/`.

### Editing an existing module

Same flow: change `module-sources/<id>/`, rebuild the ZIP with `npm run build:marketplace`, then commit source and ZIP together. Always regenerate the registry after manifest changes.

### Adding a database schema to a module

Create `module-sources/<id>/schema.prisma` with your Prisma models. If you need a relation on the `User` model, use the `// @@user-relations-start` / `// @@user-relations-end` comment block — `merge-schemas.ts` injects the fields into the merged schema automatically.

Then run:

```bash
npm run db:merge    # regenerate prisma/schema.prisma
npm run db:push     # apply to the database
```

If your module needs SQL migrations (schema changes to an already-deployed database), see [MIGRATIONS.md](MIGRATIONS.md).

---

## Theme Development

Themes live in `src/themes/<id>/`. The manifest is `theme.json` with `schemaVersion: 2`.

### Minimal manifest structure

```json
{
  "schemaVersion": 2,
  "id": "my-theme",
  "name": "My Theme",
  "description": "Short description",
  "version": "1.0.0",
  "author": "You",
  "modes": {
    "default": "light",
    "available": {
      "light": {
        "tokens": {
          "colors": { "primary": "#2563eb", "background": "#ffffff" },
          "fonts": { "heading": "Inter, sans-serif", "body": "Inter, sans-serif" }
        }
      }
    }
  }
}
```

A manifest may also declare `settings` (schema-driven settings groups), `adminRoutes` (theme-owned admin pages), `adminNav` (label/icon for the sidebar Theme group), `suggestedModules`, `slots`, `slotContents`, and `components`.

After editing `theme.json`, regenerate the theme registry:

```bash
npm run generate:themes
```

To distribute a theme, zip the `<id>/` folder and upload via Admin > Settings > Theme. The upload route validates the manifest, regenerates the registry, and activates the theme if requested.

Two themes ship in-tree:
- `flat` — minimal baseline, light and dark modes
- `pixelcraft` — gaming dark theme with MC hero section; suggests mc-stats module

---

## Core Contribution Rules

`src/core/` is the platform framework. It provides auth, database, permissions, theming, i18n, navigation, footer link structure, health, rate-limiting, maintenance mode, upload, SEO, and the module system itself.

**Never add module-specific or theme-specific code to core.** The only layout injection points core exposes are three canonical slots:

- `layout.beforeMain`
- `layout.afterMain`
- `head.extra`

Modules and themes inject into these via the slot system. No additional hardcoded slots belong in core.

### What belongs in core

- Auth system, session management, 2FA
- Permission checking utilities (RBAC)
- Database client singleton (`lib/db.ts`)
- UI component library (`components/ui/`)
- Theme system and `ThemeSlot` component
- i18n configuration and navigation helpers
- Module loader and registry generator
- Rate limiting, activity logging, maintenance mode
- Upload handler (storage provider is module-selectable)

### What belongs in a module

- Store product pages and checkout flow
- Blog article editor and categories
- Forum topics and replies
- Support ticket system
- Payment gateway integrations
- Game server integrations
- Social/auth provider buttons
- Any domain-specific admin settings page

---

## Coding Conventions

### TypeScript

- Strict mode is enabled. No `any` — use proper types or `unknown`.
- Use the `@/` path alias for all imports (resolves to `src/`).
- Validate all API inputs with Zod 4. Use `.issues` (not `.errors`) to read validation error messages.

### React

- Server components by default. Add `"use client"` only when the component needs hooks, event handlers, or browser APIs.
- Functional components with hooks only.
- No `confirm()` or `alert()` calls — use `useConfirm()` and `toast` from sonner.
- No emoji in code or UI strings — use Lucide icons exclusively.
- Sanitize HTML with DOMPurify before using `dangerouslySetInnerHTML`.

### Routing and i18n

- Use `Link` and `usePathname` from `@/core/lib/i18n/navigation` (not `next/link`) for locale-aware links.
- Use `useTranslations()` from `next-intl` for all UI text. No hardcoded strings.
- Active locales: `en` and `tr`. Translations are stored in the `Translation` DB table; seed sources are `messages-core/{en,tr}.json`.

### API Routes

- REST conventions under `/api/v1/`.
- Authenticate: `const session = await auth()`
- Check admin: `await isAdmin(session.user.id)`
- Response envelope: `{ ok: true, data }` or `{ ok: false, error, code? }` via `apiSuccess` / `apiError` / `apiPaginated` from `@/core/lib/api-utils`.
- State-changing endpoints (`POST/PUT/DELETE/PATCH`) are CSRF-protected automatically through the proxy middleware. Server-to-server callers set `x-internal-request: $CSRF_INTERNAL_SECRET`.
- Admin mutations must log to `ActivityLog` via `logActivity({ userId, action, entity, entityId, metadata })`.
- Apply `rateLimit()` on all auth-related and public-facing endpoints.

### CSS

- Tailwind CSS v4.
- Dark mode uses the `data-mode="dark"` attribute on `<html>`. Do not use `.dark` class selectors.
- Custom CSS overrides go in `globals.css`.

---

## Commit Conventions

Format: `<type>(<scope>): <description>`

Types:

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring with no behavior change |
| `docs` | Documentation only |
| `style` | Formatting, whitespace |
| `test` | Adding or updating tests |
| `chore` | Build scripts, dependencies, config |

Examples:

```
feat(forum): add thread locking for moderators
fix(auth): reset failed-login counter on successful 2FA
docs(migrations): document --bootstrap flag
chore(deps): bump next to 16.2.4
```

- Descriptive imperative-mood summaries. "add thread locking" not "added thread locking" or "adds thread locking".
- No `Co-Authored-By` lines in commits to this public repository.
- One logical change per commit. Do not bundle unrelated fixes.

---

## CI Checklist

The CI pipeline (`.github/workflows/ci.yml`) runs on every push and pull request to `main`. All steps must pass:

1. `npm ci` — clean dependency install
2. Seed `src/modules/` from `module-sources/` (CI only; simulates a fully-installed state)
3. `npx tsx scripts/merge-schemas.ts` — merge Prisma schema + generate client
4. `npm run generate:themes && npx tsx scripts/generate-registry.ts && npx tsx scripts/generate-openapi.ts`
5. `npx tsc --noEmit` — TypeScript check with zero errors
6. `npm run lint -- --max-warnings=0` — ESLint with zero warnings
7. `npm audit --audit-level=high` — fails on high or critical CVEs
8. `npm test` — unit tests via Vitest
9. `npm run build` — full production build

Before opening a PR, run locally:

```bash
npm run lint -- --max-warnings=0
npx tsc --noEmit
npm test
npm run build
```

If you changed the module manifest or added routes, also run:

```bash
npx tsx scripts/generate-registry.ts
```

---

## First PR Walkthrough

This is a concrete example of adding a new first-party module called `announcements-banner`.

### 1. Scaffold the module

```bash
npm run create:module
# Follow the prompts: id=announcements-banner, name="Announcements Banner", ...
```

Or create `module-sources/announcements-banner/` manually with:
- `module.json` — manifest
- `pages/public/page.tsx` — public-facing page
- `api/route.ts` — API handler
- `components/AnnouncementsBanner.tsx` — widget component

### 2. Write the manifest

```json
{
  "id": "announcements-banner",
  "name": "Announcements Banner",
  "version": "1.0.0",
  "author": "Your Name",
  "icon": "Megaphone",
  "routes": [{ "path": "/announcements", "component": "pages/public/page.tsx" }],
  "adminRoutes": [{ "path": "/announcements", "component": "pages/admin/page.tsx" }],
  "api": [{ "path": "/announcements", "handler": "api/route.ts" }],
  "menu": [{ "label": "Announcements", "path": "/announcements", "icon": "Megaphone" }],
  "navbarComponents": [{ "id": "AnnouncementsBanner", "component": "components/AnnouncementsBanner", "order": 10 }]
}
```

### 3. Validate and build

```bash
npm run validate:module -- announcements-banner
npm run build:marketplace
```

### 4. Test locally

Install via the admin marketplace UI or copy the source folder directly:

```bash
cp -r module-sources/announcements-banner src/modules/announcements-banner
npx tsx scripts/generate-registry.ts
npm run dev
```

Navigate to `/admin/modules` and enable the module.

### 5. Run the full CI suite locally

```bash
npx tsc --noEmit
npm run lint -- --max-warnings=0
npm test
npm run build
```

### 6. Open the PR

- Branch name: `feat/announcements-banner`
- PR title: `feat(announcements-banner): add announcements banner module`
- Description: what the module does, screenshots if UI-heavy, note any new permissions it registers.
- Ensure `module-sources/announcements-banner/` and `module-marketplace/announcements-banner.zip` plus updated `module-marketplace/index.json` are all committed together.
- Never include anything under `src/modules/` or `src/core/generated/` unless you intentionally changed the core generator scripts.

---

## Review Process

1. A maintainer reviews the PR for adherence to the core-knows-nothing principle.
2. CI must be green (all 9 steps above).
3. Module manifests are checked for correct permission declarations and correct icon names (Lucide only).
4. New core changes require two maintainer approvals. Module-only changes require one.
5. Once approved and merged to `main`, the CI build runs and the marketplace artifacts are published automatically.
