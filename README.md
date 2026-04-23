<div align="center">
  <h1>uxwVend</h1>

  ![CI](https://github.com/siracozmen01/uxwVend/actions/workflows/ci.yml/badge.svg)

  <p><strong>Open-source modular platform with a plugin marketplace</strong></p>
  <p>Zero modules by default. Install what you need. 41 verified modules available, plus custom ZIP uploads.</p>

  ![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
  ![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma)
  ![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)
  ![Zod](https://img.shields.io/badge/Zod-4-3E67B1)
  ![Auth.js](https://img.shields.io/badge/Auth.js-v5-purple)
  ![License](https://img.shields.io/badge/License-MIT-green)
</div>

---

## What is uxwVend?

uxwVend is a plugin-first platform for game server websites, digital storefronts, and community portals. The core ships empty — every feature is a module installed from the built-in marketplace or uploaded as a ZIP. Themes are declarative manifest packages that handle presentation, component overrides, and schema-driven admin settings pages.

**Three strict layers:**

1. **Core** — site-type-agnostic infrastructure: auth, RBAC, i18n, navigation link structure, health, rate limiting (Redis + memory fallback), maintenance, upload, SEO. Zero module or theme names in core code.
2. **Modules** — feature layer. Each module declares its own routes, API, sidebar, widgets, dashboard cards, and more via `module.json`.
3. **Themes** — presentation + composition. Each theme declares modes (light/dark), color/font tokens, schema-driven settings groups, and optional component overrides via `theme.json`.

---

## Available Modules

| Category | Modules |
|----------|---------|
| **Commerce** | Store, Stripe Gateway, PayPal Gateway, Credits, Currency, Coupons, Gift Codes, Chest, VIP, Leaderboard, Revenue Goals |
| **Community** | Blog, Forum, Suggestions, Changelog, Vote Sites, Wheel of Fortune |
| **Gaming** | Servers (Minecraft, FiveM, Rust, ARK, CS2), Player Profiles, Punishments, Downloads, RCON Delivery |
| **Management** | Tickets, Help Center, Notifications, Analytics, Security, 2FA, Activity Log, Scheduled Tasks |
| **Content** | Slider, Staff Page, Announcements, Popups, Custom Pages, Custom Forms |
| **Integration** | Discord Webhooks, Email (Resend), OAuth (Discord/Google), Cloudflare Turnstile |

---

## Plugin System

- **One-click install/uninstall** from the admin marketplace
- **ZIP upload** for custom or third-party modules
- **Dependency resolution** — modules declare what they require
- **Conflict detection** — incompatible modules cannot be active simultaneously
- **Self-registering UI** — each module declares its own:

| Hook | Purpose |
|------|---------|
| `navLinks` | Public navbar entries |
| `footerLinks` | Footer link sections |
| `menu` | Admin sidebar items |
| `dashboardCards` / `statsApi` | Admin dashboard stat cards |
| `widgets` / `homepageSections` | Homepage content areas |
| `profileTabs` | User profile tabs |
| `settingsCards` | Admin settings page entries |
| `oauthButtons` | Login/register OAuth buttons |
| `navbarComponents` | Navbar icons (cart, bell, etc.) |
| `layoutComponents` | Global layout injections |
| `cronJobs` | Background scheduled tasks |
| `webhookReceivers` | Inbound webhook endpoints |
| `slotContents` | Content contributed into named slots |
| `hookListeners` | Cross-module event listeners |
| `notificationTypes` | Notification type registration |

---

## Theme System (v2)

Themes live in `src/themes/<id>/` and ship with a `theme.json` manifest (`schemaVersion: 2`).

- **Modes** — one manifest, multiple named modes (e.g. light + dark). No separate dark-variant themes.
- **Tokens** — `colors`, `fonts`, `radius`, `space` fields with customizer metadata.
- **Settings** — `settings.<group>.fields.<key>` schema. Core auto-renders `/admin/theme/<group>` — theme author writes zero React for standard settings pages.
- **Components** — optional React overrides wired via `<ThemeComponentSlot>`.
- **Slots** — themes can declare and contribute into named content slots.
- **Admin nav** — each theme specifies its own label and Lucide icon for the sidebar "Theme" group.

**Shipped themes:**

| Theme | Description |
|-------|-------------|
| `flat` | Default baseline. Light + dark modes. No component overrides. |
| `pixelcraft` | Gaming/Minecraft preset. Dark only. Compact Hypixel-style hero. Suggests mc-stats + store modules. |

**Data model:**
- `ThemeState` (singleton, id=1) — active themeId + mode
- `ThemeCustomization` — `@@unique([themeId, mode])`, mode-scoped token overrides
- `ThemeSetting` — `@@unique([themeId, groupKey, key])` for grouped settings

---

## Quick Start

**Prerequisites:** Node.js 20+, PostgreSQL 15+

```bash
git clone https://github.com/siracozmen01/uxwVend.git
cd uxwVend
npm install

cp .env.example .env
# Edit .env — set DATABASE_URL and AUTH_SECRET at minimum

npm run db:push
npm run db:seed         # 3 roles + admin user (admin@uxwvend.com / admin123)
npm run dev             # starts on port 3001
```

---

## Project Structure

```
src/
├── app/[locale]/          # Next.js App Router (i18n locale routing)
│   ├── (admin)/           # Admin panel
│   ├── (auth)/            # Auth pages
│   └── (public)/          # Public pages
├── core/                  # Core framework (auth, db, RBAC, i18n, rate-limit, upload, SEO)
│   ├── components/        # Shared UI components
│   ├── generated/         # Codegen output (module-registry, theme-registry, etc.)
│   ├── lib/               # Utilities and services
│   ├── hooks/             # React hooks
│   └── providers/         # Context providers
├── modules/               # Installed modules (auto-discovered at runtime)
├── themes/                # Installed themes (flat + pixelcraft shipped)
└── proxy.ts               # Middleware (i18n + module route gating)

module-marketplace/        # 41 installable module ZIPs + index.json catalog
module-sources/            # Module source code (tracked in git)
theme-marketplace/         # Installable theme ZIPs
scripts/                   # Codegen, migration, and tooling scripts
prisma/schema.core.prisma  # Core schema (DO NOT edit schema.prisma directly)
```

---

## Commands

```bash
# Development
npm run dev              # Dev server (Turbopack, port 3001, 0.0.0.0)
npm run build            # Production build
npm run start            # Production server
npx pm2 start npm --name uxwvend -- start -- -p 3001 -H 0.0.0.0

# Database
npm run db:merge         # Merge core + module schemas → prisma/schema.prisma
npm run db:generate      # Run prisma generate
npm run db:push          # Push schema to database (no migrations)
npm run db:seed          # Seed core data: 3 roles + admin user
npm run db:studio        # Prisma Studio GUI
npm run db:backup        # Backup database
npm run db:restore       # Restore from backup

# Code generation
npm run generate:themes                    # theme-registry + theme-tokens.css + theme-admin-routes.ts
npx tsx scripts/generate-registry.ts      # module-registry.tsx + module-routes.ts
npx tsx scripts/seed-translations.ts      # Sync translations from messages-core + module manifests to DB

# Tooling
npm run create:module    # Scaffold new module from template
npm run validate:module  # Validate module manifest
npm run lint             # ESLint (--max-warnings=0)
npm run clean            # Clear .next cache

# Testing
npm test                 # Vitest (290+ tests)
npm run test:e2e         # Playwright
```

---

## Module Development

```bash
npm run create:module my-module "My Module" "What it does"
# Scaffolds module-sources/my-module/ from module-template/

# After editing module.json and schema.prisma:
npm run db:merge && npm run db:push
npx tsx scripts/generate-registry.ts
npm run dev
```

See `module-template/README.md` for full authoring guide and `CLAUDE.md` for manifest reference.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
