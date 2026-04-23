# Module Template

This is the starter template for creating uxwVend modules. Use it with the scaffold command or copy it manually.

---

## Quick Start

```bash
npm run create:module my-module "My Module" "Short description"
# Copies module-template/ to module-sources/my-module/ with placeholders replaced
```

---

## Directory Structure

```
my-module/
├── module.json          # Module manifest (required)
├── schema.prisma        # Prisma models (optional, merged automatically)
├── api/
│   └── route.ts         # API route handler → /api/v1/my-module/items
├── pages/
│   ├── public/
│   │   └── page.tsx     # Public page → /[locale]/my-module
│   └── admin/
│       └── page.tsx     # Admin page → /[locale]/admin/my-module
├── components/
│   └── ExampleWidget.tsx  # Reusable components
├── widgets/
│   └── ExampleWidget.tsx  # Homepage sidebar widget
└── messages/
    ├── en.json          # English translations (optional if using manifest translations)
    └── tr.json          # Turkish translations
```

---

## module.json Manifest

The manifest is the single source of truth for everything the module registers. See `CLAUDE.md` for the complete field reference and cheat sheet. The template `module.json` includes all fields with comments — delete the ones you don't need.

### Required fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (lowercase, hyphens only, e.g. `my-module`) |
| `name` | Display name shown in marketplace and admin UI |
| `version` | Semver version string |

### UI registration fields (all optional)

| Field | Purpose |
|-------|---------|
| `routes` | Public pages served under `/[locale]/[path]` |
| `adminRoutes` | Admin pages served under `/[locale]/admin/[path]` |
| `api` | API handlers served under `/api/v1/[path]` |
| `menu` | Admin sidebar items (label, path, icon) |
| `navLinks` | Public navbar entries |
| `footerLinks` | Footer link sections |
| `navbarComponents` | Components rendered in the navbar (cart icon, bell, etc.) |
| `layoutComponents` | Components rendered on every page (banners, toasts, modals) |
| `homepageSections` | Homepage content sections |
| `widgets` | Homepage sidebar widgets |
| `profileTabs` | User profile page tabs |
| `dashboardCards` / `statsApi` | Admin dashboard stat cards + data endpoint |
| `settingsCards` | Admin settings page entries |
| `oauthButtons` | OAuth login buttons |
| `slotContents` | Content contributed into named slots (core or theme-declared) |

### Behavior fields (all optional)

| Field | Purpose |
|-------|---------|
| `dependencies` | Module IDs that must be installed and enabled |
| `conflicts` | Module IDs that cannot be active simultaneously |
| `permissions` | RBAC permission strings this module adds |
| `cronJobs` | Background scheduled tasks |
| `webhookReceivers` | Inbound webhook endpoints |
| `hookListeners` | Cross-module event listeners |
| `notificationTypes` | Notification type registration |
| `translations` | Inline `{locale: {namespace: {key: value}}}` — synced to Translation table on install |

---

## Database Models

Add a `schema.prisma` file to declare your module's Prisma models. Prefix model names with your module to avoid collisions (e.g. `MyModuleItem`).

To add relations to the core `User` model, use the comment block:

```prisma
// @@user-relations-start
orders MyModuleOrder[]
// @@user-relations-end
```

Then run:

```bash
npm run db:merge   # Merges core + all module schemas → prisma/schema.prisma
npm run db:push    # Applies changes to the database
```

Delete `schema.prisma` entirely if your module has no database models.

---

## Local Development Workflow

```bash
# 1. Scaffold your module
npm run create:module my-module "My Module" "What it does"

# 2. Edit module.json — remove fields you don't need
# 3. Edit schema.prisma — define your models (or delete if not needed)

# 4. Merge schema and push to DB
npm run db:merge && npm run db:push

# 5. Register routes with the codegen
npx tsx scripts/generate-registry.ts

# 6. Install the module (copy to src/modules/)
cp -r module-sources/my-module src/modules/my-module

# 7. Start dev server
npm run dev

# 8. Enable the module in admin → Modules
```

The module appears in the marketplace and can be enabled/disabled without restarting the server after the initial codegen step.

---

## Key Conventions

- **Server components by default** — add `"use client"` only when needed
- **No hardcoded strings** — use `useTranslations()` from `next-intl` or declare `translations` in `module.json`
- **Auth checks** — admin pages call `isAdmin()` from `@/core/lib/permissions`, API write endpoints verify the session
- **Imports** — use `@/core/lib/*` for core utilities, relative paths within your module
- **No `any` types** — TypeScript strict; use proper types
- **No `confirm()`/`alert()`** — use `useConfirm()` + `toast` from sonner
- **No emojis in UI** — Lucide icons only
- **API responses** — `{ data }` on success, `{ error, status }` on error

---

## Validation

```bash
npm run validate:module module-sources/my-module
```

---

## Build and Publish

```bash
# Build all marketplace ZIPs from module-sources/
npm run build:marketplace

# The ZIP lands in module-marketplace/my-module.zip
# Update module-marketplace/index.json to list the new module
```
