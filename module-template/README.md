# Module Template

This is a starter template for creating uxwVend modules.

## Quick Start

```bash
# Generate a new module from this template
npm run create:module my-awesome-module "My Awesome Module" "Description of the module"
```

This copies the template to `module-sources/my-awesome-module/` with all placeholders replaced.

## Directory Structure

```
my-module/
├── module.json          # Module manifest (required)
├── schema.prisma        # Prisma models (optional, merged automatically)
├── api/
│   └── route.ts         # API route handlers → /api/v1/my-module/items
├── pages/
│   ├── public/
│   │   └── page.tsx     # Public page → /[locale]/my-module
│   └── admin/
│       └── page.tsx     # Admin page → /[locale]/admin/my-module
├── components/
│   └── ExampleWidget.tsx  # Reusable components
├── widgets/
│   └── ExampleWidget.tsx  # Homepage sidebar widgets
└── messages/
    ├── en.json          # English translations
    ├── tr.json          # Turkish translations
    └── de.json          # German translations
```

## module.json Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier (lowercase, hyphens only) |
| `name` | Yes | Display name |
| `description` | No | Short description |
| `version` | Yes | Semver version |
| `author` | No | Author name |
| `icon` | No | Lucide icon name |
| `dependencies` | No | Module IDs this module requires |
| `conflicts` | No | Module IDs that conflict with this one |
| `permissions` | No | Permission strings for RBAC |
| `defaultConfig` | No | Default configuration values |
| `seedOnInstall` | No | Run seed data on first install |
| `menu` | No | Admin sidebar menu items |
| `routes` | No | Public page routes |
| `adminRoutes` | No | Admin page routes |
| `api` | No | API endpoint handlers |
| `widgets` | No | Homepage sidebar widgets |
| `navLinks` | No | Navigation bar links |
| `footerLinks` | No | Footer links |
| `navbarComponents` | No | Components rendered in navbar |
| `layoutComponents` | No | Components rendered on every page |
| `homepageSections` | No | Homepage content sections |
| `profileTabs` | No | User profile page tabs |
| `dashboardCards` | No | Admin dashboard stat cards |
| `statsApi` | No | API path for dashboard statistics |
| `settingsCards` | No | Admin settings page cards |
| `oauthButtons` | No | OAuth login buttons |
| `translations` | No | Inline i18n translations |

## Key Conventions

- **Server components by default** -- add `"use client"` only when needed
- **Auth checks** -- admin pages check `isAdmin()`, API write endpoints check auth
- **Imports** -- use `@/core/lib/*` for core utilities, relative paths within your module
- **Prisma models** -- prefix with module name (e.g., `MyModuleItem`) to avoid collisions
- **User relations** -- declare in `@@user-relations-start/end` comment block in schema.prisma
- **Translations** -- use `useTranslations()` from `next-intl`, never hardcode strings

## After Creating Your Module

1. Edit `module.json` -- remove fields you don't need
2. Edit `schema.prisma` -- define your database models (or delete if not needed)
3. Run `npm run db:merge` to merge your schema
4. Run `npm run db:push` to apply database changes
5. Copy to `src/modules/your-module/` to install
6. Run `npx tsx scripts/generate-registry.ts` to register routes
7. Run `npm run dev` to test

## Validation

```bash
# Check your module for common issues
npm run validate:module module-sources/my-module
```
