<div align="center">
  <h1>uxwVend</h1>

  ![CI](https://github.com/siracozmen01/uxwVend/actions/workflows/ci.yml/badge.svg)

  <p><strong>Modular plugin-based platform with a built-in marketplace</strong></p>
  <p>Ships with zero modules. Install what you need from 42 first-party modules in the marketplace, or upload custom ZIPs.</p>

  ![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
  ![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)
  ![Prisma](https://img.shields.io/badge/Prisma-7.6-2D3748?logo=prisma)
  ![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)
  ![Zod](https://img.shields.io/badge/Zod-4-3E67B1)
  ![Auth.js](https://img.shields.io/badge/Auth.js-v5-purple)
  ![License](https://img.shields.io/badge/License-MIT-green)
</div>

---

## What is uxwVend?

uxwVend is a plugin-first platform for game-server websites, digital storefronts, and community portals. The core ships empty — every feature is a module installed at runtime through the admin panel or uploaded as a ZIP. Themes are declarative manifest packages that handle presentation, component overrides, and schema-driven admin settings pages.

### Core motto

**Core knows nothing about any module or theme.** No module names, no module paths, no module-specific code anywhere in `src/core/`. No theme names hardcoded. Everything is registry-driven from manifests. When a module or theme is not installed, zero traces exist in core.

### Three strict layers

1. **Core** (`src/core/`) — site-type-agnostic infrastructure: auth, RBAC, i18n, navigation/footer link structure, health, rate limiting (Redis + memory fallback), maintenance, upload, SEO. A fixed set of canonical slot names — the generic `layout.beforeMain`, `layout.afterMain`, `head.extra` plus layout-position slots (`layout.top`, `layout.bottom`, `navbar.start`, `navbar.end`, `footer.top`, `mobile.nav`).
2. **Modules** (`src/modules/<id>/`) — feature layer. Everything declared in `module.json`.
3. **Themes** (`src/themes/<id>/`) — presentation + composition. Everything declared in `theme.json` (`schemaVersion: 2`).

---

## Module System

42 first-party modules ship in `module-marketplace/` as ZIPs with an `index.json` catalog. Sources live in `module-sources/<id>/` (tracked in git). ZIPs are built from those sources via `npm run build:marketplace`.

| Category | Modules |
|----------|---------|
| Commerce | store, stripe-gateway, paypal-gateway, credits, currency, vote, wheel, leaderboard |
| Community | blog, forum, suggestions, changelog, in-app-notifications, referral, trophies |
| Gaming | servers, player-profiles, punishments, downloads |
| Management | tickets, help-center, staff, announcements, popups, login-protection, two-factor-auth |
| Content | slider, custom-pages, custom-forms, email-templates, cookie-consent, seo |
| Integration | discord-auth, discord-integration, discord-widget, google-auth, google-analytics, cloudflare-r2, cloudflare-turnstile, resend-provider, csv-import-export, webhook-logs |

Each `module.json` declares everything the module contributes — routes, admin routes, API endpoints, sidebar menu, dashboard cards, widgets, navbar/footer/layout components, profile tabs, settings cards, OAuth buttons, dependencies, conflicts, RBAC permissions, cron jobs, webhook receivers, hook listeners, slot contributions, search providers, page-builder blocks, notification types, and translations. See [docs/PLUGIN_SDK.md](docs/PLUGIN_SDK.md) for the complete reference.

**Lifecycle:** install (extract ZIP → regenerate registry → run module SQL migrations → create `ModuleConfig` row → sync translations) → enable → disable (vanishes from every UI surface, data preserved) → uninstall (files removed, `ModuleConfig` deleted, admin-overridden translations preserved). The DB (`ModuleConfig.enabled`) is the single source of truth for whether a module is active.

**Install safety:** Postgres advisory lock prevents concurrent installs in PM2 cluster mode. Registry regeneration runs synchronously and rolls back the filesystem on failure — no silent partial installs.

---

## Theme System (v2)

Themes live in `src/themes/<id>/` with a `theme.json` manifest. `schemaVersion: 2` is required. Modes (light / dark / any named variant) live inside a single manifest — there are no separate dark-variant themes and no parent inheritance. v1 manifests are rejected at upload.

A theme manifest can declare:

- **`modes`** — default mode + per-mode token values (`tokens.colors`, `tokens.fonts`).
- **`tokens.colors` / `tokens.fonts` / `tokens.radius` / `tokens.space`** — field definitions for the customizer.
- **`settings.<group>.fields.<key>`** — schema-driven admin settings. Core auto-renders `/admin/theme/<group>` with labels, inputs, save/reset — theme author writes zero React for these. Field types: `text`, `url`, `color`, `richtext`, `image`.
- **`components.<Name>: "components/Foo.tsx"`** — React component overrides wired via `<ThemeComponentSlot name="...">`.
- **`slots` / `slotContents`** — declare named slots and contribute into own or core-declared slots.
- **`adminNav.label` / `adminNav.icon`** — sidebar "Theme" group label and Lucide icon for this theme.
- **`adminRoutes`** — escape hatch for custom React admin pages.
- **`suggestedModules`** — opt-in banner recommending modules (never auto-installs).
- **`translations`** — synced to the Translation DB table on activation.

**Shipped themes:**

| Theme | Description |
|-------|-------------|
| `flat` | Default baseline. Light + dark modes in one manifest. No component overrides, no settings. |
| `pixelcraft` | Gaming/Minecraft preset. Dark only. Compact Hypixel-style 3-column hero (server IP \| logo \| Discord) with schema-driven settings. Declares a `hero.liveStats` slot. Suggests the `store` module. |

**Data model:**

- `ThemeState` (singleton, `id = 1`) — active themeId + mode.
- `ThemeCustomization` (`@@unique([themeId, mode])`) — mode-scoped token override JSON.
- `ThemeSetting` (`@@unique([themeId, groupKey, key])`) — settings values. `groupKey` is named that way because `group` is a SQL reserved word.

No `Theme` DB model — filesystem + codegen is the source of truth for theme existence.

---

## Quick Start

Prerequisites: Node.js 24+, PostgreSQL 14+. Redis is optional but strongly recommended in production.

```bash
git clone https://github.com/siracozmen01/uxwVend.git
cd uxwVend
npm install                            # postinstall runs db:merge + generate-themes + generate-registry

cp .env.example .env
# Edit .env — at minimum: DATABASE_URL, AUTH_SECRET, AUTH_URL

npm run db:merge                       # merge core + module schemas
npm run db:push                        # push merged schema to the database
npm run db:seed                        # seed 3 roles + admin user
npx tsx scripts/seed-translations.ts   # seed default locale strings
npm run dev                            # Turbopack on http://localhost:3001
```

Default admin credentials: `admin@example.com` / `password123`. **Change the password immediately after first login.**

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production setup (PM2, nginx, Redis, backups, environment variables, hardening).

---

## Project Structure

```
src/
  app/[locale]/             Next.js App Router (i18n locale segment)
    (admin)/                Admin panel
    (auth)/                 Auth pages
    (public)/               Public pages
    (setup)/                First-run setup wizard
    [...slug]/              Catch-all for module-contributed public routes
  app/api/v1/               Core REST API + [...path] catch-all for module APIs
  core/                     Site-type-agnostic infrastructure
    components/             Shared UI primitives, layout, admin shell
    generated/              Codegen output (gitignored)
    lib/                    Utilities and services (db, auth, hooks, scheduler, ...)
    providers/              ModuleProvider, ThemeProvider
  modules/                  Installed module state (gitignored — populated at runtime)
  themes/                   Installed themes (flat + pixelcraft ship in-tree)
  proxy.ts                  Middleware: i18n + module route gating + CSRF

messages-core/{en,tr}.json  Core translation seed sources
module-sources/<id>/        Authoritative source for 42 first-party modules
module-marketplace/         Distributable ZIPs + index.json catalog
theme-marketplace/          Distributable theme ZIPs
module-template/            Starter for `npm run create:module`
scripts/                    Codegen, migration, backup, marketplace tooling
prisma/schema.core.prisma   Core schema (never edit the merged schema.prisma directly)
```

---

## Commands

```bash
# Development
npm run dev              # Dev server (Turbopack, port 3001, 0.0.0.0)
npm run build            # Production build (prebuild = merge-schemas + generate-themes + generate-registry + generate-openapi)
npm run start            # Production server

# Database
npm run db:merge         # Merge core + module schemas into prisma/schema.prisma
npm run db:generate      # Run prisma generate
npm run db:push          # Push merged schema to the database (no migrations for core)
npm run db:migrate       # Apply per-module SQL migrations (see docs/MIGRATIONS.md)
npm run db:seed          # Seed 3 roles + admin user
npm run db:studio        # Prisma Studio
npm run db:backup        # Gzipped SQL dump to ./backups/
npm run db:restore       # Restore from a backup file

# Code generation
npm run generate:themes                       # theme-registry + theme-tokens.css + theme-components + theme-admin-routes
npx tsx scripts/generate-registry.ts          # module-registry + module-routes + module-hooks + module-crons + ...
npx tsx scripts/generate-openapi.ts           # src/core/generated/openapi.json from module manifests
npx tsx scripts/seed-translations.ts          # Sync translations from messages-core + module manifests into DB

# Tooling
npm run create:module <id> "Name" "Desc"      # Scaffold a module from module-template/
npm run validate:module module-sources/<id>   # Validate a module manifest
npm run build:marketplace                     # Rebuild every marketplace ZIP from module-sources/
npm run lint                                   # ESLint
npm run clean                                  # Clear .next + node_modules/.cache

# Testing
npm test                 # Vitest
npm run test:e2e         # Playwright
```

---

## Authoring a Module

```bash
npm run create:module my-module "My Module" "Short description"
# Creates module-sources/my-module/ from module-template/ with placeholders replaced.

# Edit module.json, optionally schema.prisma, components, pages, api/
npm run db:merge && npm run db:push           # If you added DB models
npm run build:marketplace                     # Package as ZIP + update index.json
```

Install via **Admin > Modules > Upload ZIP** or **Marketplace**, then enable the toggle on the module card.

For local development you can also copy the source directly into `src/modules/<id>/` and run `npx tsx scripts/generate-registry.ts` to wire it up without packaging.

See [docs/PLUGIN_SDK.md](docs/PLUGIN_SDK.md) for the full manifest reference and [module-template/README.md](module-template/README.md) for the starter walkthrough.

---

## Documentation

- [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) — admin panel walkthrough (modules, themes, users, roles, settings)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — production deployment (PM2, nginx, Redis, backups, env vars)
- [docs/PLUGIN_SDK.md](docs/PLUGIN_SDK.md) — module authoring reference with complete `module.json` schema
- [docs/API.md](docs/API.md) — REST API reference, auth, rate limiting, module APIs, webhooks, cron
- [docs/MIGRATIONS.md](docs/MIGRATIONS.md) — per-module SQL migration system
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — contribution guide, coding conventions, CI checks
- [module-template/README.md](module-template/README.md) — scaffold a new module from the template

---

## License

MIT License — see [LICENSE](LICENSE) for details.
