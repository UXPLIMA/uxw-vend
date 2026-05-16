# Contributing to uxwVend

## Core Principle

**Core knows nothing about any module or theme.** No module names, paths, or model references in `src/core/` or `src/app/`. No theme names hardcoded anywhere. Everything is registry-driven from `module.json` and `theme.json` manifests. When a module is not installed, zero traces exist in the codebase.

Any domain feature (store, forum, blog, tickets, analytics, payment gateway, game integration) belongs in a module under `module-sources/`, not in core.

---

## Development Setup

### Prerequisites

- Node.js 24+ (enforced by `engines` in `package.json`)
- PostgreSQL 14+
- Git
- Redis is optional for development; required in multi-worker production

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
npm run db:merge                          # merge core + module schemas into prisma/schema.prisma
npm run db:push                           # push the merged schema to the database
npm run db:seed                           # creates 3 roles + admin user
npx tsx scripts/seed-translations.ts      # seed default en/tr strings into the Translation table
```

Start the dev server:

```bash
npm run dev
```

The `predev` hook runs `db:merge` + `generate:themes` + `generate-registry` automatically before Turbopack starts on `http://localhost:3001` (host `0.0.0.0`). You do not need to run those manually on startup.

Default admin credentials: `admin@example.com` / `password123` — change immediately.

---

## Directory Structure

```
src/
  core/                 platform framework (auth, RBAC, i18n, DB, rate limiting, module/theme systems)
  app/                  Next.js App Router pages (all locale-aware under [locale]/)
  app/api/              core REST endpoints + [...path] catch-all that dispatches module APIs
  modules/              RUNTIME install state (gitignored — populated by admin UI or dev workflow)
  themes/               installed themes (flat + pixelcraft ship in-tree)
  proxy.ts              middleware: i18n + module route gating + CSRF

module-sources/         authoritative source for 41 first-party modules (tracked in git)
module-marketplace/     distributable ZIPs (tracked) + index.json catalog
theme-marketplace/      distributable theme ZIPs
module-template/        starter template for `npm run create:module`
messages-core/          en.json + tr.json seed sources for core translations
scripts/                code-gen, migrations, backup, marketplace tooling
prisma/                 schema.core.prisma (core models) + seed.ts
```

`src/modules/` is gitignored. It is the runtime install state, populated by `npm run create:module` + manual copy during development, or by the admin marketplace UI in production. CI seeds it from `module-sources/` so the type checker sees every module-contributed Prisma model.

---

## Module Development Workflow

All feature work goes into a module. See [PLUGIN_SDK.md](PLUGIN_SDK.md) for the full manifest reference.

### Directory trio

| Directory | Role | Git status |
|---|---|---|
| `module-sources/<id>/` | Authoritative source for first-party modules | Tracked |
| `module-marketplace/<id>.zip` | Distributable artifact installed via the marketplace UI | Tracked |
| `src/modules/<id>/` | Runtime install state — what the running platform sees | **Gitignored** |

### Creating a new module

```bash
npm run create:module my-module "My Module" "Short description"
```

This copies `module-template/` into `module-sources/my-module/` and replaces placeholders (`my-module`, `My Module`, `MyModule`, `myModule`, `MyModuleItem`, etc.) with the right identifiers.

Then:

1. Edit `module-sources/my-module/module.json` — keep only the fields you need.
2. Edit `module-sources/my-module/schema.prisma` (or delete it if no DB models).
3. Author pages, API handlers, components.
4. Validate the manifest:
   ```bash
   npm run validate:module module-sources/my-module
   ```
5. If you added DB models:
   ```bash
   npm run db:merge && npm run db:push
   ```
6. Build the marketplace artifact:
   ```bash
   npm run build:marketplace
   ```
   This rebuilds every ZIP in `module-marketplace/` from `module-sources/` and regenerates `module-marketplace/index.json`.
7. Install locally — either through the admin marketplace UI, or for fast iteration:
   ```bash
   cp -r module-sources/my-module src/modules/my-module
   npx tsx scripts/generate-registry.ts
   ```
8. Commit `module-sources/my-module/` **and** `module-marketplace/my-module.zip` **and** the updated `module-marketplace/index.json` in the same commit. Never commit anything under `src/modules/` or `src/core/generated/`.

### Editing an existing module

Same flow: edit `module-sources/<id>/`, rebuild the ZIP with `npm run build:marketplace`, commit source + ZIP + updated index together.

### Adding a database schema to a module

Create `module-sources/<id>/schema.prisma` with your Prisma models. Prefix model names with the module ID to avoid collisions across modules. To add a relation on the core `User` model, use the comment-block marker:

```prisma
// @@user-relations-start
orders MyModuleOrder[] @relation("UserMyModuleOrders")
// @@user-relations-end
```

`scripts/merge-schemas.ts` injects these lines into the `User` model at the `// @@MODULE_RELATIONS` marker in `schema.core.prisma`.

Then run `npm run db:merge && npm run db:push`. For schema changes to an already-deployed module, write a SQL migration in `module-sources/<id>/migrations/NNN_description.sql` — see [MIGRATIONS.md](MIGRATIONS.md).

---

## Theme Development

Themes live in `src/themes/<id>/` with a `theme.json` manifest (`schemaVersion: 2`). Modes (light, dark, any named variant) live inside a single manifest — no separate dark-variant themes and no parent inheritance. v1 manifests are rejected on upload.

### Minimal manifest

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
            },
            "dark": {
                "tokens": {
                    "colors": { "primary": "#60a5fa", "background": "#0b1220" },
                    "fonts": { "heading": "Inter, sans-serif", "body": "Inter, sans-serif" }
                }
            }
        }
    },
    "adminNav": { "label": "My Theme", "icon": "Palette" }
}
```

Optional fields a manifest may also declare: `tokens` (customizer metadata), `settings.<group>.fields.<key>` (schema-driven admin pages auto-rendered at `/admin/theme/<group>`), `components.<Name>` (React overrides wired via `<ThemeComponentSlot name="...">`), `slots`, `slotContents`, `adminRoutes`, `suggestedModules`, `translations`.

After editing `theme.json`:

```bash
npm run generate:themes
```

This regenerates `theme-registry.ts`, `theme-tokens.css`, `theme-components.tsx`, and `theme-admin-routes.ts` (all gitignored).

To distribute a theme, zip the `<id>/` folder and upload via **Admin > Settings > Theme**. The upload route validates the manifest, regenerates the registry, and the theme appears in the library.

Two themes ship in-tree:

- `flat` — baseline. Light + dark modes. No component overrides, no settings.
- `pixelcraft` — gaming/Minecraft preset. Dark only. Hypixel-style hero with schema-driven settings (title, subtitle, bgImage, logoImage, serverIp, ctaText, ctaHref, discordUrl). Declares `hero.liveStats` and `hero.discordStats` slots. Suggests `servers` + `store` modules.

---

## Core Contribution Rules

`src/core/` is the platform framework. It provides auth, database, permissions, theming, i18n, navigation/footer structure, health, rate limiting, maintenance mode, upload, SEO, and the module + theme systems themselves.

**Never add module-specific or theme-specific code to core.** The only layout slots core exposes are three canonical names:

- `layout.beforeMain`
- `layout.afterMain`
- `head.extra`

Modules contribute into these via the `slotContents` manifest field. Themes can declare additional slots in their `slots` array; modules then fill them. No additional hardcoded slot names belong in core.

### What belongs in core

- Auth system, session management, 2FA verification
- Permission checking utilities (RBAC: `hasPermission`, `isAdmin`, `isStaff`)
- Database client singleton (`lib/db.ts`)
- UI primitive library (`components/ui/`)
- Theme system and `<ThemeComponentSlot>`
- i18n configuration, navigation helpers, request-time translation reader
- Module loader, registry generator, scheduler, hook bus
- Rate limiting, activity logging, maintenance mode, IP blocks
- Upload handler (storage provider is module-selectable via `storageProviders`)

### What belongs in a module

- Store products, checkout, orders
- Blog articles, categories, comments
- Forum topics, replies, moderation
- Support tickets, help-center articles
- Payment-gateway integrations (Stripe, PayPal, etc.)
- Game-server integrations (RCON, Minecraft, FiveM, Rust, ARK, CS2)
- OAuth provider buttons (Discord, Google, etc.)
- Any domain-specific admin settings page

---

## Coding Conventions

### TypeScript

- Strict mode is on. No `any` — use proper types or `unknown`.
- Use `@/*` for all imports (resolves to `src/*`).
- Validate API inputs with Zod 4. Read errors via `.issues`, not `.errors`.

### React

- Server components by default. Add `"use client"` only when the component needs hooks, event handlers, or browser APIs.
- Functional components with hooks only.
- No `confirm()` or `alert()` — use `useConfirm()` from `@/core/components/ui/confirm-dialog` and `toast` from `sonner`.
- No emoji in code or UI strings — use Lucide icons exclusively.
- Sanitize HTML with `dompurify` / `isomorphic-dompurify` before any `dangerouslySetInnerHTML`.

### Routing and i18n

- Use `Link`, `usePathname`, and `redirect` from `@/core/lib/i18n/navigation` — never `next/link`.
- Use `useTranslations()` (client) / `getTranslations()` (server) from `next-intl` for all UI text. No hardcoded strings.
- Active locales: `en`, `tr` (see `src/core/lib/i18n/config.ts`). Translations are read from the `Translation` DB table at request time; seed sources are `messages-core/{en,tr}.json` and each module's `translations` block.

### API Routes

- REST conventions under `/api/v1/`.
- Authenticate: `const session = await auth()`. Check admin: `await isAdmin(session.user.id)`.
- Response envelope: `apiSuccess` / `apiError` / `apiPaginated` from `@/core/lib/api-utils` for new code (`{ ok: true, data }` / `{ ok: false, error, code? }`).
- Mutating endpoints (`POST/PUT/DELETE/PATCH`) are CSRF-checked by the proxy middleware. Server-to-server callers set `x-internal-request: $CSRF_INTERNAL_SECRET`.
- Admin mutations should log via `logActivity({ userId, action, entity, entityId, metadata })`.
- Apply `rateLimit()` or `rateLimitForRole()` on auth-related and public-facing endpoints.

### CSS

- Tailwind CSS v4.
- Dark mode uses the `data-mode="dark"` attribute on `<html>` (or a container element). Do not use a `.dark` class selector.
- Custom CSS overrides go in `globals.css` or the admin **Custom CSS** field.

---

## Commit Conventions

Format: `<type>(<scope>): <description>`

| Type | When |
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

Rules:

- Imperative mood. "add thread locking", not "added" / "adds".
- No `Co-Authored-By` lines in this repository.
- One logical change per commit.

---

## CI Checklist

`.github/workflows/ci.yml` runs on every push and PR to `main`. All steps must pass:

1. `npm ci`
2. Seed `src/modules/` from `module-sources/` (CI only — simulates a fully-installed state so the type checker sees every model)
3. `npx tsx scripts/merge-schemas.ts` (merge Prisma schema + generate client)
4. `npm run generate:themes && npx tsx scripts/generate-registry.ts && npx tsx scripts/generate-openapi.ts`
5. `npx tsc --noEmit` (zero errors)
6. `npm run lint` (zero warnings)
7. `npm audit --audit-level=high`
8. `npm test`
9. `npm run build`

Run locally before opening a PR:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

If you changed a manifest or added/removed routes, also run:

```bash
npx tsx scripts/generate-registry.ts
```

---

## First PR Walkthrough

Concrete example: adding a first-party module called `announcements-banner`.

### 1. Scaffold

```bash
npm run create:module announcements-banner "Announcements Banner" "Banner for site-wide announcements"
```

This populates `module-sources/announcements-banner/` from the template with placeholders replaced.

### 2. Edit the manifest

```json
{
    "id": "announcements-banner",
    "name": "Announcements Banner",
    "description": "Banner for site-wide announcements",
    "version": "1.0.0",
    "author": "Your Name",
    "icon": "Megaphone",
    "permissions": ["announcements-banner.manage"],
    "routes": [{ "path": "/announcements", "component": "pages/public/page.tsx" }],
    "adminRoutes": [{ "path": "/announcements", "component": "pages/admin/page.tsx" }],
    "api": [{ "path": "/announcements", "handler": "api/route.ts", "description": "List and create announcements" }],
    "menu": [{ "label": "Announcements", "path": "/announcements", "icon": "Megaphone" }],
    "layoutComponents": [
        { "id": "AnnouncementsBanner", "component": "components/AnnouncementsBanner", "include": ["/*"], "exclude": ["/admin/*"] }
    ]
}
```

### 3. Validate, build, install locally

```bash
npm run validate:module module-sources/announcements-banner
npm run build:marketplace

cp -r module-sources/announcements-banner src/modules/announcements-banner
npx tsx scripts/generate-registry.ts
npm run dev
```

Visit `/admin/modules` and toggle the module on.

### 4. Run the full CI suite locally

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

### 5. Open the PR

- Branch name: `feat/announcements-banner`
- PR title: `feat(announcements-banner): add announcements banner module`
- Description: what the module does, screenshots if UI-heavy, list any new permissions registered.
- Committed files: `module-sources/announcements-banner/`, `module-marketplace/announcements-banner.zip`, updated `module-marketplace/index.json`.
- Never committed: anything under `src/modules/`, anything under `src/core/generated/` (unless you intentionally changed a generator script).

---

## Review Process

1. A maintainer reviews the PR for adherence to the core-knows-nothing principle.
2. CI must be green (all nine steps above).
3. Module manifests are checked for correct permission declarations and Lucide-only icon names.
4. New `src/core/` changes require two maintainer approvals. Module-only changes require one.
5. Once merged, the CI build runs and marketplace artifacts publish automatically.

---

## Cross-references

- [PLUGIN_SDK.md](PLUGIN_SDK.md) — complete `module.json` reference and authoring patterns
- [MIGRATIONS.md](MIGRATIONS.md) — per-module SQL migrations
- [API.md](API.md) — REST API surface and module API dispatch
- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) — admin panel walkthrough
- [DEPLOYMENT.md](DEPLOYMENT.md) — production deployment
- [../module-template/README.md](../module-template/README.md) — module starter template
