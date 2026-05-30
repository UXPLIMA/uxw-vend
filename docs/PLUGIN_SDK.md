# Plugin SDK

The reference for module authors. Every behavior a module contributes is declared in `module.json` and wired by code generation — there are no decorators, no runtime registrations, and no entries in core that name a specific module.

uxwVend ships with **zero modules**. The 41 first-party modules in `module-marketplace/` are installed at runtime through the admin panel just like any third-party module. Core knows nothing about any of them.

Module sources live under `module-sources/<id>/` (tracked in git, authoritative for first-party modules). Installed modules live under `src/modules/<id>/` (gitignored, runtime install state). The two directories are separate: `module-sources/` is the authoring workspace; `src/modules/` is what the running platform sees.

---

## Quick Start

```bash
npm run create:module my-module "My Module" "Short description"
# Creates module-sources/my-module/ from module-template/ with placeholders replaced.

# Edit module.json, optionally schema.prisma, write pages/api/components
npm run validate:module module-sources/my-module
npm run build:marketplace                                       # rebuild every ZIP + index.json

# Fast local install (skip the marketplace UI):
cp -r module-sources/my-module src/modules/my-module
npx tsx scripts/generate-registry.ts
npm run dev
```

Install via **Admin > Modules > Upload ZIP** or **Marketplace** for production-style flow.

---

## Directory Layout

```
src/modules/my-module/
├── module.json                  Required — manifest
├── schema.prisma                Optional — Prisma models merged at db:merge time
├── migrations/                  Optional — per-module SQL migrations (NNN_description.sql)
├── pages/
│   ├── public/page.tsx          Public page component
│   └── admin/page.tsx           Admin page component
├── api/
│   └── route.ts                 API route handler (named GET/POST/PUT/DELETE/PATCH exports)
├── components/                  Module-scoped React components
├── widgets/                     Homepage sidebar widget components
├── hooks/                       hookListeners handlers + webhook handlers
├── cron/                        cron job handlers
├── search/                      searchProviders handlers
├── seo/                         seoRoutes sitemap handler
├── slots/                       slotContents components
├── blocks/                      pageBlocks components
├── providers/                   contextProviders components
├── lib/                         Module-scoped utilities (incl. storageProviders handler)
└── messages/                    Optional locale JSON (translations also inline-able in manifest)
```

Only `module.json` is required. Include only the directories your module needs.

---

## `module.json` Reference

### Required

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique lowercase ID. Letters, digits, hyphens. Must start with a letter, no double hyphens. Must match the directory name. |
| `name` | `string` | Human-readable display name. |
| `description` | `string` | Short description shown in admin and marketplace. |
| `version` | `string` | Semver string, e.g. `"1.0.0"`. |

### Optional metadata

| Field | Type | Description |
|-------|------|-------------|
| `author` | `string` | Author name. |
| `icon` | `string` | Lucide icon name shown in the admin sidebar. |
| `permissions` | `string[]` | RBAC permission strings the module registers (e.g. `["store.view", "store.manage"]`). |
| `defaultConfig` | `object` | Default config values merged with the DB-stored `ModuleConfig.config` at runtime. |
| `dependencies` | `string[]` | Module IDs that must be installed and enabled. Enable fails when a dependency is missing. |
| `conflicts` | `string[]` | Module IDs that cannot be active simultaneously. |
| `hooks.onEnable` / `hooks.onDisable` | `string` | Path to a default-exported handler run when the module is enabled / disabled. Use this to seed default data on install. |

### `routes` — Public pages

Rendered at `/{locale}/{path}` via the `[...slug]` catch-all.

```json
"routes": [
    { "path": "/my-page", "component": "pages/public/page.tsx" },
    { "path": "/my-page/[id]", "component": "pages/public/detail.tsx", "layout": "pages/public/layout.tsx" }
]
```

| Field | Required | Description |
|-------|----------|-------------|
| `path` | Yes | URL path under `/[locale]`. Supports dynamic segments (`[id]`, `[...params]`). |
| `component` | Yes | Path to the page component, relative to the module root. |
| `layout` | No | Optional layout wrapper component. |

### `adminRoutes` — Admin pages

Rendered at `/{locale}/admin/{path}` inside the admin layout (auth guard, sidebar, and header are provided automatically — never re-implement them).

```json
"adminRoutes": [
    { "path": "/my-module", "component": "pages/admin/page.tsx" },
    { "path": "/my-module/settings", "component": "pages/admin/settings.tsx" }
]
```

### `api` — API endpoints

Mounted at `/api/v1/{path}` via the `[...path]` catch-all that resolves `ModuleApiRegistry`.

```json
"api": [
    {
        "path": "/my-module/items",
        "handler": "api/items/route.ts",
        "method": "ALL",
        "description": "List and create items"
    }
]
```

| Field | Required | Description |
|-------|----------|-------------|
| `path` | Yes | Path under `/api/v1/`. Dynamic segments OK. |
| `handler` | Yes | Path to the handler file, relative to the module root. Export named `GET` / `POST` / `PUT` / `DELETE` / `PATCH` functions. |
| `method` | No | `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, or `ALL`. Defaults to `ALL`. The dispatcher returns 405 if the request method doesn't match. |
| `description` | No | OpenAPI summary surfaced in the generated spec at `/api/v1/openapi`. |

### `menu` — Admin sidebar

```json
"menu": [
    { "label": "My Items", "path": "/my-module/items", "icon": "Package" },
    { "label": "Settings", "path": "/my-module/settings", "icon": "Settings" }
]
```

`path` is relative to `/admin`. `icon` is a Lucide icon name.

### `navLinks` — Public navbar entries

```json
"navLinks": [
    { "label": "My Page", "href": "/my-page", "icon": "Star", "position": 50 }
]
```

Lower `position` renders further left.

### `footerLinks` — Footer links

```json
"footerLinks": [
    { "label": "My Page", "href": "/my-page", "section": "quick" }
]
```

`section` is `"quick"` or `"legal"`.

### `navbarComponents` — Navbar right-side widgets

Icons or controls rendered in the navbar's right-hand area (cart icon, notification bell, currency selector, etc.).

```json
"navbarComponents": [
    { "id": "CartIcon", "component": "components/CartIcon", "order": 20 }
]
```

Lower `order` renders further left.

### `footerComponents` — Footer widgets

Components rendered next to the language selector in the footer.

```json
"footerComponents": [
    { "id": "CurrencySelector", "component": "components/CurrencySelector", "order": 10, "section": "settings" }
]
```

### `layoutComponents` — Per-page components

Components rendered on every matching page when the module is enabled (toasts, banners, popups, floating widgets). Use the URL filter to scope.

```json
"layoutComponents": [
    {
        "id": "AnnouncementBanner",
        "component": "components/AnnouncementBanner",
        "include": ["/*"],
        "exclude": ["/admin/*"]
    }
]
```

`include` / `exclude` are glob-style URL patterns. Omit both to render on every route.

### `widgets` — Homepage sidebar widgets

```json
"widgets": [
    {
        "id": "MyWidget",
        "component": "widgets/MyWidget",
        "defaultOrder": 5,
        "defaultVisible": true
    }
]
```

### `homepageSections` — Homepage content sections

```json
"homepageSections": [
    {
        "id": "MySection",
        "type": "content",
        "component": "components/MySection",
        "order": 10
    }
]
```

`type` is `"content"` (main area) or `"widget"` (sidebar).

### `profileTabs` — User profile tabs

```json
"profileTabs": [
    { "id": "my-history", "label": "History", "component": "components/ProfileHistory", "order": 5 }
]
```

### `dashboardCards` — Admin dashboard stat cards

```json
"dashboardCards": [
    {
        "id": "my-stat",
        "label": "Items",
        "labelKey": "dashboard_items",
        "icon": "Package",
        "href": "/admin/my-module/items",
        "color": "text-blue-500",
        "statKey": "itemCount"
    }
]
```

`labelKey` is an i18n key in the `admin` namespace — preferred over `label` when present. `statKey` is the property the dashboard reads from your `statsApi` response to populate the value.

### `statsApi` — Dashboard data endpoint

```json
"statsApi": "/my-module/stats"
```

The dashboard issues `GET /api/v1/my-module/stats` and expects `{ cards: { [statKey: string]: number | string }, sections?: [...] }`. Permission gating is the handler's responsibility.

### `settingsCards` — Admin settings page cards

```json
"settingsCards": [
    {
        "title": "My Settings",
        "description": "Configure the module",
        "href": "/settings/my-module",
        "icon": "Settings",
        "color": "text-gray-500"
    }
]
```

### `oauthButtons` — Login/register OAuth buttons

```json
"oauthButtons": [
    {
        "id": "discord-login",
        "provider": "discord",
        "label": "Discord",
        "color": "#5865F2",
        "svgIcon": "M19.27 5.33..."
    }
]
```

`svgIcon` is raw SVG `d` path data (no `<svg>` wrapper). `provider` must match a NextAuth provider ID configured by the module.

### `contextProviders` — React context wrappers

Components that wrap the entire app tree. Unlike `layoutComponents` (rendered as siblings), context providers receive `children` and wrap them.

```json
"contextProviders": [
    { "id": "CurrencyProvider", "component": "providers/currency", "order": 10 }
]
```

Lower `order` = outer wrapper.

### `hookListeners` — Action/filter listeners

WordPress-style hooks wired at build time. Listeners are auto-registered when the module is enabled and removed on disable.

```json
"hookListeners": [
    { "hook": "user.registered", "type": "action", "handler": "hooks/on-user-registered.ts", "priority": 10 },
    { "hook": "post.content",    "type": "filter", "handler": "hooks/filter-content.ts",     "priority": 20 }
]
```

- `type: "action"` — fire and forget. Handler: `(payload, context?) => void | Promise<void>`.
- `type: "filter"` — value transformation. Handler: `(value, context?) => value | Promise<value>`.
- `priority` — lower runs earlier. Default 10.
- Async listeners have a per-listener timeout (default 5 s, override with `HOOK_LISTENER_TIMEOUT_MS`).

Core-fired actions include `user.registered`, `module.enabled`, `module.disabled`. Modules fire their own hooks via `doAction` / `applyFilters` from `@/core/lib/hooks`.

### `slotContents` — Slot contributions

Render components into named `<Slot>` points declared by themes or other modules.

```json
"slotContents": [
    {
        "id": "popup-renderer",
        "slot": "layout.overlay",
        "component": "slots/PopupRenderer",
        "order": 20
    }
]
```

Core declares a fixed set of canonical slots — the generic `layout.beforeMain`, `layout.afterMain`, `head.extra` plus layout-position slots `layout.top`, `layout.bottom`, `navbar.start`, `navbar.end`, `footer.top`, `mobile.nav` (see `src/core/lib/slot-registry.ts`). Themes can declare additional slots through their `slots[]` array (e.g. `pixelcraft` exposes `hero.liveStats`).

### `pageBlocks` — Page-builder blocks

Module-contributed blocks available in the page editor.

```json
"pageBlocks": [
    { "id": "SliderHero", "category": "Slider", "component": "blocks/SliderHero.tsx" }
]
```

### `cronJobs` — Scheduled tasks

Periodic tasks run by the core scheduler.

```json
"cronJobs": [
    { "id": "currency-rate-refresh", "schedule": "every-hour", "handler": "cron/refresh.ts" }
]
```

Valid `schedule` keywords: `every-minute`, `every-5-minutes`, `every-15-minutes`, `every-hour`, `every-day`, `every-week`, `every-month`.

Handler file: `export default async function (): Promise<void>`. Last-run state is recorded in the `CronRun` table.

### `searchProviders` — Site search

```json
"searchProviders": [
    { "id": "blog-search", "label": "Blog", "handler": "search/handler.ts" }
]
```

Handler: `export default async (query: string) => Promise<SearchResult[]>`. `GET /api/v1/search` merges results from every enabled provider.

### `webhookReceivers` — Inbound webhooks

Routed by `POST /api/v1/webhook/{provider}`.

```json
"webhookReceivers": [
    {
        "provider": "stripe",
        "handler": "hooks/webhook.ts",
        "signatureHeader": "stripe-signature",
        "secretEnv": "STRIPE_WEBHOOK_SECRET"
    }
]
```

When `signatureHeader` + `secretEnv` are set, HMAC-SHA256 verification runs against the raw body using a constant-time comparator. Deliveries older than `WEBHOOK_REPLAY_WINDOW_MS` (default 5 minutes) are rejected.

Handler: `export default async (request: Request) => Promise<{ status: number; body?: unknown }>`.

### `notificationTypes` — User notification preferences

Surfaces in the profile preferences grid so users can opt out per channel.

```json
"notificationTypes": [
    { "eventType": "blog.article.created", "label": "New blog post", "description": "Sent when a new article is published.", "channels": ["email", "inapp"] }
]
```

### `storageProviders` — File-storage backends

Implement the `StorageProvider` interface from `@/core/lib/storage`. The active provider is selected at runtime via the `storage_active_provider` Setting key (or the `STORAGE_PROVIDER` env var).

```json
"storageProviders": [
    { "id": "cloudflare-r2", "name": "Cloudflare R2", "handler": "lib/provider.ts" }
]
```

Handler: `export default: StorageProvider`.

### `seoRoutes` — Sitemap contribution

```json
"seoRoutes": { "handler": "seo/sitemap.ts" }
```

Handler: `export default async () => Promise<SitemapEntry[]>`.

### `translations` — Bundled i18n strings

Synced into the `Translation` DB table on install and removed on uninstall. **Admin-overridden rows survive uninstall** — the sync never overwrites a row that has been manually edited.

```json
"translations": {
    "en": {
        "blog": { "title": "Blog", "readMore": "Read more" }
    },
    "tr": {
        "blog": { "title": "Blog", "readMore": "Devamını oku" }
    }
}
```

Sync manually with `npx tsx scripts/seed-translations.ts`.

---

## Database

### Adding models

Create `schema.prisma` in the module source directory. Prefix model names with the module ID to avoid collisions:

```prisma
model MyModuleItem {
    id        String   @id @default(cuid())
    title     String
    status    String   @default("ACTIVE")
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    userId    String
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId])
    @@index([status])
}
```

To add fields on the core `User` model, use the marker block:

```prisma
// @@user-relations-start
items MyModuleItem[]
// @@user-relations-end
```

`scripts/merge-schemas.ts` injects these lines into the core `User` model at the `// @@MODULE_RELATIONS` marker. Do not redeclare core models — the merger warns on core-model redeclaration.

After editing the schema:

```bash
npm run db:merge      # regenerates prisma/schema.prisma + runs prisma generate
npm run db:push       # applies the diff to the database
```

### SQL migrations

Schema changes against an already-deployed database go through `module-sources/<id>/migrations/NNN_description.sql`. The runner (`scripts/apply-migrations.ts`) tracks applied files in `ModuleMigration` with SHA-256 checksums, wraps every file in a transaction, and aborts on checksum mismatch. See [MIGRATIONS.md](MIGRATIONS.md) for the full system.

---

## Writing Pages

### Public page (server component, default)

```tsx
import { getTranslations } from "next-intl/server";
import { Link } from "@/core/lib/i18n/navigation";

export default async function MyPage() {
    const t = await getTranslations("my-module");

    return (
        <main className="container mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <Link href="/my-page/about">{t("about")}</Link>
        </main>
    );
}
```

Rules:

- Use `Link`, `usePathname`, `redirect` from `@/core/lib/i18n/navigation` — never `next/link`.
- No hardcoded UI strings — use `useTranslations` (client) or `getTranslations` (server) from `next-intl`.
- No emojis in UI — use Lucide icons.
- No `confirm()` / `alert()` — use `useConfirm()` and `toast` from `sonner`.

### Client page with data fetching

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/core/components/ui/card";

interface Item { id: string; name: string }

export default function MyPage() {
    const [items, setItems] = useState<Item[]>([]);

    useEffect(() => {
        fetch("/api/v1/my-module/items")
            .then((res) => res.json())
            .then((res) => setItems(res.items ?? []));
    }, []);

    return (
        <main className="container mx-auto px-4 py-6">
            <div className="grid gap-4">
                {items.map((item) => (
                    <Card key={item.id}><CardContent className="p-4">{item.name}</CardContent></Card>
                ))}
            </div>
        </main>
    );
}
```

### Admin page

Admin pages render inside the admin layout — sidebar, header, and auth guard are already provided. Export your content directly:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";

export default function MyAdminPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">My Module Management</h1>
            <Card>
                <CardHeader><CardTitle>Items</CardTitle></CardHeader>
                <CardContent><Button>Create item</Button></CardContent>
            </Card>
        </div>
    );
}
```

---

## Writing API Routes

API handlers follow Next.js App Router conventions. Export a named function per HTTP method:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin, hasPermission } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";
import { apiSuccess, apiError, apiPaginated } from "@/core/lib/api-utils";

// GET /api/v1/my-module/items
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page  = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    const [items, total] = await Promise.all([
        prisma.myModuleItem.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
        prisma.myModuleItem.count(),
    ]);
    return apiPaginated(items, total, page, limit);
}

// POST /api/v1/my-module/items
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return apiError("Unauthorized", 401);
    if (!(await hasPermission(session.user.id, "my-module.manage"))) {
        return apiError("Forbidden", 403);
    }

    const schema = z.object({ title: z.string().min(1).max(255) });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
        // Zod 4: use .issues not .errors
        return apiError("Validation failed", 400, { code: "invalid_input", details: parsed.error.issues });
    }

    const item = await prisma.myModuleItem.create({
        data: { title: parsed.data.title, userId: session.user.id },
    });
    await logActivity({ userId: session.user.id, action: "my-module.item.create", entity: "my-module.item", entityId: item.id });
    return apiSuccess({ item }, 201);
}

// DELETE /api/v1/my-module/items/[id] — admin only
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return apiError("Unauthorized", 401);
    if (!(await isAdmin(session.user.id))) return apiError("Forbidden", 403);

    const { id } = await params;
    await prisma.myModuleItem.delete({ where: { id } });
    return apiSuccess({ ok: true });
}
```

The canonical envelope is `{ ok: true, data }` / `{ ok: false, error, code?, details? }` from `@/core/lib/api-utils`. Legacy `{ error }` / `{ data }` shapes still work but new code should standardize.

---

## Core Imports

```typescript
// Database
import { prisma } from "@/core/lib/db";

// Auth & permissions
import { auth } from "@/core/lib/auth";
import { isAdmin, isStaff, hasPermission, hasAnyPermission } from "@/core/lib/permissions";

// Validation (Zod 4 — read .issues, not .errors)
import { z } from "zod";

// Activity logging
import { logActivity } from "@/core/lib/activity-log";

// Discord webhooks (generic sender)
import { sendDiscordWebhook } from "@/core/lib/discord";

// Email (Resend backend, falls back to console in dev)
import { sendEmail } from "@/core/lib/email";

// Rate limiting (Redis + memory fallback, trust-proxy aware)
import { rateLimit, rateLimitForRole, getClientIP } from "@/core/lib/rate-limit";

// API envelope helpers
import { apiSuccess, apiError, apiPaginated, devOnlyDetail } from "@/core/lib/api-utils";

// Hooks (action/filter system)
import { doAction, doActionAsync, applyFilters, applyFiltersAsync, addAction, addFilter } from "@/core/lib/hooks";

// i18n — navigation
import { Link, usePathname, redirect } from "@/core/lib/i18n/navigation";

// i18n — translations
import { useTranslations } from "next-intl";                       // client
import { getTranslations } from "next-intl/server";                // server

// Theme config (client only — server reads ThemeState directly)
import { useThemeConfig } from "@/core/lib/theme-config-client";

// UI primitives
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { toast } from "sonner";
```

---

## Hook System

The hook system in `src/core/lib/hooks.ts` is WordPress-style, type-safe, and ESM-first.

**Actions** — fire and forget:

```typescript
import { doAction, doActionAsync } from "@/core/lib/hooks";

doAction("my-module.item.created", { itemId: item.id, userId });
await doActionAsync("my-module.order.completed", { orderId });
```

**Filters** — value transformation:

```typescript
import { applyFilters, applyFiltersAsync } from "@/core/lib/hooks";

const processed = applyFilters("post.content", rawHtml, { postId });
const result    = await applyFiltersAsync("checkout.total", baseTotal, { cart });
```

**Registering listeners imperatively** (rarely needed — prefer declaring `hookListeners` in the manifest so the build-time registry can manage them):

```typescript
import { addAction, addFilter } from "@/core/lib/hooks";

addAction("user.registered", (payload) => { /* ... */ }, 10, "my-module");
addFilter("post.content", (html) => html.replace(/badword/g, "***"), 20, "my-module");
```

Listeners declared in `hookListeners` are wired at build time and automatically removed when the module is disabled or uninstalled.

---

## Cheat Sheet — Full Manifest

```json
{
    "id": "my-module",
    "name": "My Module",
    "description": "What it does",
    "version": "1.0.0",
    "author": "Your Name",
    "icon": "Star",

    "dependencies": ["other-module"],
    "conflicts": ["incompatible-module"],
    "permissions": ["mymod.view", "mymod.manage"],
    "defaultConfig": { "exampleSetting": true },

    "routes":            [{ "path": "/my-page", "component": "pages/public/page.tsx" }],
    "adminRoutes":       [{ "path": "/my-feature", "component": "pages/admin/page.tsx" }],
    "api":               [{ "path": "/my-api", "handler": "api/route.ts", "method": "ALL", "description": "..." }],
    "menu":              [{ "label": "My Feature", "path": "/my-feature", "icon": "Star" }],
    "navLinks":          [{ "label": "My Page", "href": "/my-page", "icon": "Star", "position": 50 }],
    "footerLinks":       [{ "label": "My Page", "href": "/my-page", "section": "quick" }],
    "navbarComponents":  [{ "id": "MyIcon", "component": "components/MyIcon", "order": 30 }],
    "footerComponents":  [{ "id": "MyFooter", "component": "components/MyFooter", "order": 10 }],
    "layoutComponents":  [{ "id": "MyBanner", "component": "components/MyBanner", "include": ["/*"], "exclude": ["/admin/*"] }],
    "widgets":           [{ "id": "MyWidget", "component": "widgets/MyWidget", "defaultOrder": 10, "defaultVisible": true }],
    "homepageSections":  [{ "id": "MySection", "type": "content", "component": "components/MySection", "order": 20 }],
    "profileTabs":       [{ "id": "MyTab", "label": "My Tab", "component": "components/MyTab", "order": 30 }],
    "dashboardCards":    [{ "id": "my-stat", "label": "My Stat", "labelKey": "dashboard_my_stat", "icon": "Star", "href": "/admin/my-feature", "color": "text-blue-500", "statKey": "myCount" }],
    "statsApi":          "/my-api/stats",
    "settingsCards":     [{ "title": "My Settings", "description": "...", "href": "/my-settings", "icon": "Settings", "color": "text-gray-500" }],
    "oauthButtons":      [{ "id": "my-login", "provider": "my-provider", "label": "My Login", "color": "#000000", "svgIcon": "M12..." }],
    "contextProviders":  [{ "id": "MyProvider", "component": "providers/MyProvider", "order": 10 }],
    "hookListeners":     [{ "hook": "user.registered", "type": "action", "handler": "hooks/on-user.ts", "priority": 10 }],
    "slotContents":      [{ "id": "MySlot", "slot": "layout.beforeMain", "component": "slots/MyBanner", "order": 10 }],
    "pageBlocks":        [{ "id": "MyBlock", "category": "My Category", "component": "blocks/MyBlock.tsx" }],
    "cronJobs":          [{ "id": "my-job", "schedule": "every-hour", "handler": "cron/hourly.ts" }],
    "searchProviders":   [{ "id": "my-search", "label": "My Search", "handler": "search/handler.ts" }],
    "webhookReceivers":  [{ "provider": "stripe", "handler": "hooks/webhook.ts", "signatureHeader": "stripe-signature", "secretEnv": "STRIPE_WEBHOOK_SECRET" }],
    "notificationTypes": [{ "eventType": "my.event", "label": "My Event", "channels": ["email", "inapp"] }],
    "storageProviders":  [{ "id": "my-storage", "name": "My Storage", "handler": "lib/provider.ts" }],
    "seoRoutes":         { "handler": "seo/sitemap.ts" },
    "translations": {
        "en": { "my-module": { "title": "My Module" } },
        "tr": { "my-module": { "title": "Modülüm" } }
    }
}
```

Delete any field you don't use — every UI registration field is optional.

---

## Packaging and Distribution

### Build the marketplace ZIP

```bash
npm run build:marketplace
```

This rebuilds every ZIP in `module-marketplace/` from `module-sources/` and regenerates `module-marketplace/index.json` (the catalog the admin UI reads).

### Manual zip (single module)

```bash
cd module-sources/my-module
zip -r ../../module-marketplace/my-module.zip . -x "*.DS_Store" -x "__MACOSX/*"
```

The ZIP must contain `module.json` at its root.

### Install paths

- **Admin > Modules > Marketplace** — installs from the bundled catalog (or the configured remote source).
- **Admin > Modules > Upload ZIP** — uploads an arbitrary `.zip` file.
- **Local copy** — `cp -r module-sources/my-module src/modules/` then `npx tsx scripts/generate-registry.ts`.

The install handler (whichever route fires) follows the same pipeline:

1. Extract to a temp directory and validate `module.json`.
2. Acquire a Postgres advisory lock (serializes installs in PM2 cluster).
3. Copy files to `src/modules/{id}/`.
4. Run `db:merge` if the module declares a schema.
5. Apply pending SQL migrations (`apply-migrations` scoped to this module).
6. Run `scripts/generate-registry.ts` synchronously.
7. Create the `ModuleConfig` DB row (`enabled: true`).
8. Sync `translations` into the `Translation` table.
9. On any failure: roll back the filesystem and abort. No silent partial installs.

`scheduleBuild()` then fires a debounced background `npm run build && pm2 restart` so the new module's bundled code is available — bulk installs in quick succession trigger only one rebuild.

---

## Module Lifecycle

| Event | What happens |
|-------|--------------|
| Install | Files extracted to `src/modules/<id>/`, schema merged, SQL migrations applied, registry regenerated, `ModuleConfig` row created (`enabled: true`), translations synced. |
| Enable | Module appears in every UI surface — sidebar, navbar, homepage, dashboard, settings, profile. Hook listeners, cron jobs, search providers, webhook receivers, slot contents — all active. |
| Disable | Module vanishes from all UI surfaces. Listeners, crons, and other runtime contributions removed. DB data preserved. |
| Uninstall | Files deleted, `ModuleConfig` row deleted, registry regenerated. Module translations removed (admin-overridden rows preserved). Module-owned tables are NOT dropped — a maintainer must run the SQL manually if they want a clean wipe. |

The DB (`ModuleConfig.enabled`) is the single source of truth for whether a module is active. Filesystem presence alone does not mean a module is enabled — this was a past footgun and is no longer the case.

---

## Conventions Checklist

- No `any` types — proper types or `unknown`.
- Zod 4: use `.issues`, not `.errors`, on `SafeParseError`.
- ES imports only — no `require()`.
- Path alias `@/*` resolves to `src/*`.
- `Link`, `usePathname`, `redirect` from `@/core/lib/i18n/navigation` — never `next/link`.
- `"use client"` only when the component needs browser APIs, hooks, or event handlers.
- Lucide icons only — no emoji.
- `useConfirm()` + `toast` from `sonner` — no `confirm()` / `alert()`.
- API responses: `apiSuccess` / `apiError` / `apiPaginated` from `@/core/lib/api-utils`.
- Dark mode: `data-mode="dark"` attribute, CSS variables — no `.dark` class selector.

---

## Cross-references

- [API.md](API.md) — REST API conventions, error envelope, rate limiting, webhook + cron dispatch
- [MIGRATIONS.md](MIGRATIONS.md) — per-module SQL migration system
- [CONTRIBUTING.md](CONTRIBUTING.md) — development workflow, coding conventions, CI checks
- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) — admin panel walkthrough
- [../module-template/README.md](../module-template/README.md) — starter template
