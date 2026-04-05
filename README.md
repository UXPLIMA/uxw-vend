<div align="center">
  <h1>uxwVend</h1>
  <p><strong>Open-source modular platform with a plugin marketplace</strong></p>
  <p>Zero modules by default. Install what you need. 37 verified modules available, plus custom ZIP uploads.</p>

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

uxwVend is a plugin-first platform for game server websites, digital storefronts, and community portals. The core ships empty — every feature is a module you install with one click from the built-in marketplace, or upload as a ZIP.

Modules are fully self-contained: they register their own routes, API endpoints, navbar links, footer links, dashboard cards, homepage widgets, profile tabs, settings pages, OAuth buttons, and layout components. Enable, disable, or swap them at any time without touching code.

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
- **Dependency resolution** — modules declare what they require (e.g. Stripe Gateway requires Store)
- **Conflict detection** — incompatible modules cannot be active simultaneously
- **Self-registering UI** — each module declares its own:

| Hook | Purpose |
|------|---------|
| `navLinks` | Public navbar entries |
| `footerLinks` | Footer link sections |
| `menu` | Admin sidebar items |
| `dashboardCards` | Admin dashboard stat cards |
| `widgets` / `homepageSections` | Homepage content areas |
| `profileTabs` | User profile tabs |
| `settingsCards` | Admin settings page entries |
| `oauthButtons` | Login/register OAuth buttons |
| `navbarComponents` | Navbar icons (cart, bell) |
| `layoutComponents` | Global layout injections |

---

## Theme System

Themes are declarative config packages in `src/themes/`. The platform ships with a flat default theme. Additional themes (e.g. PixelCraft) are available from the marketplace or uploaded as ZIPs.

- Dark mode toggle (`data-mode="dark"`)
- Live color customization from admin panel
- Custom CSS injection
- Component-level overrides via `ThemeSlot`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| Language | TypeScript 5.9 |
| Database | PostgreSQL + Prisma 6.19 |
| Validation | Zod 4 |
| Auth | Auth.js v5 (credentials, Discord, Google OAuth) |
| Styling | Tailwind CSS 4 |
| Payments | Stripe + PayPal |
| Email | Resend |
| i18n | next-intl (EN, TR, DE) |
| Charts | Chart.js |
| Icons | Lucide React |

---

## Quick Start

**Prerequisites:** Node.js 20+, PostgreSQL 15+

```bash
git clone https://github.com/siracozmen01/uxwVend.git
cd uxwVend
npm install

cp .env.example .env
# Edit .env — set DATABASE_URL and AUTH_SECRET at minimum

npx prisma db push
npm run db:seed        # optional — loads demo data
npm run dev            # starts on port 3001
```

The first-time setup wizard will guide you through initial configuration.

---

## Project Structure

```
src/
├── app/[locale]/          # Next.js App Router (i18n locale routing)
│   ├── (admin)/           # Admin panel
│   ├── (auth)/            # Auth pages
│   └── (public)/          # Public pages
├── core/                  # Core framework (auth, db, payments, RBAC, i18n)
│   ├── components/        # Shared UI components
│   ├── lib/               # Utilities and services
│   ├── hooks/             # React hooks
│   └── providers/         # Context providers
├── modules/               # Installed modules (auto-discovered)
├── themes/                # Theme packages
└── proxy.ts               # Middleware (i18n + module route gating)
```

---

## Module Development

Create a directory in `src/modules/your-module/` with a `module.json` manifest:

```json
{
    "id": "your-module",
    "name": "Your Module",
    "description": "What it does",
    "version": "1.0.0",
    "author": "You",
    "icon": "Package",
    "dependencies": ["store"],
    "navLinks": [
        { "label": "My Page", "href": "/my-page", "position": 5 }
    ],
    "routes": [
        { "path": "/my-page", "component": "pages/public/page.tsx" }
    ],
    "adminRoutes": [
        { "path": "/my-module", "component": "pages/admin/page.tsx" }
    ],
    "api": [
        { "path": "/my-module/data", "handler": "api/data/route.ts" }
    ],
    "menu": [
        { "label": "My Module", "path": "/my-module", "icon": "Package" }
    ]
}
```

Then regenerate the registry:

```bash
npx tsx scripts/generate-registry.ts
```

Modules can also declare `widgets`, `dashboardCards`, `profileTabs`, `settingsCards`, `oauthButtons`, `navbarComponents`, `layoutComponents`, and `homepageSections`. See `src/core/lib/module-types.ts` for the full manifest schema.

---

## Commands

```bash
npm run dev              # Development server (Turbopack, port 3001)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint
npm run clean            # Clear .next cache
npm run db:push          # Push Prisma schema to database
npm run db:migrate       # Create and apply migration
npm run db:seed          # Seed demo data
npm run db:studio        # Prisma Studio GUI
npm run db:backup        # Backup database
npm run db:restore       # Restore from backup
npm run generate:themes  # Regenerate theme registry
```

---

## API

OpenAPI spec is available at `/api/v1/openapi` when the server is running. API key authentication is supported for external integrations.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.
