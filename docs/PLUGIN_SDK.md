# uxwVend Plugin SDK

## Overview

uxwVend is a plugin-based platform built on Next.js 16.2 (App Router), TypeScript 5.9, Prisma 6.19, Auth.js v5, Tailwind CSS v4, and Zod 4.

The platform ships with zero modules. All functionality comes from modules installed from the marketplace or uploaded as ZIPs. Core knows nothing about any module — no module names, no hardcoded paths, no module-specific code anywhere in `src/core/`. Everything is driven by `module.json` manifests processed at build time.

Module sources live under `module-sources/<id>/` (tracked in git). Installed modules live under `src/modules/<id>/`. The two directories are separate: `module-sources/` is the authoring workspace; `src/modules/` is what the running platform sees.

---

## Creating a Module

### 1. Create the directory

```
src/modules/my-module/
```

The directory name must match the `id` field in `module.json`.

### 2. Create `module.json`

```json
{
    "id": "my-module",
    "name": "My Module",
    "description": "What the module does",
    "version": "1.0.0",
    "author": "Your Name",
    "icon": "Star"
}
```

Only `id`, `name`, `description`, and `version` are required. `icon` must be a valid Lucide icon name.

### 3. Regenerate the registry

```bash
npx tsx scripts/generate-registry.ts
```

This scans `src/modules/`, validates every `module.json` against the manifest schema, and writes:

- `src/core/generated/module-registry.tsx` — dynamic `import()` map for every component and API handler
- `src/core/generated/module-routes.ts` — route patterns for middleware gating
- Several additional generated files: `module-hooks.ts`, `module-crons.ts`, `module-webhooks.ts`, `module-search.ts`, `module-seo.ts`, `module-storage.ts`, `module-blocks.ts`, `module-notification-types.ts`, `slot-registry.tsx`

Run this after any `module.json` change or after adding/removing files referenced in the manifest.

### 4. Enable in the database

Installing via the admin UI (Upload ZIP or Marketplace Install) creates the `ModuleConfig` row automatically with `enabled: true`. During development you can create the row manually or via `prisma studio`.

---

## Directory Layout

```
src/modules/my-module/
├── module.json                       # Required — manifest
├── pages/
│   ├── public/page.tsx               # Public page component
│   └── admin/page.tsx                # Admin page component
├── api/
│   └── my-module/route.ts            # API route handler
├── components/                       # Module-scoped React components
├── hooks/                            # Hook listener handlers
├── cron/                             # Cron job handlers
├── search/                           # Search provider handlers
├── seo/                              # SEO sitemap handler
├── slots/                            # Slot contribution components
├── blocks/                           # Page-builder block components
├── providers/                        # React context providers
├── lib/                              # Module-scoped utilities
├── schema.prisma                     # Optional — module DB models
└── migrations/                       # Optional — SQL migration files
```

Only `module.json` is required. Include only what your module needs.

---

## `module.json` Full Reference

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier. Lowercase letters, numbers, hyphens only. Must match the directory name. |
| `name` | `string` | Human-readable display name. |
| `description` | `string` | Short description shown in admin. |
| `version` | `string` | Semver string, e.g. `"1.0.0"`. |

### Optional metadata

| Field | Type | Description |
|-------|------|-------------|
| `author` | `string` | Author name. |
| `icon` | `string` | Lucide icon name shown in the admin sidebar. |
| `permissions` | `string[]` | Permission strings this module registers (e.g. `["store.view", "store.manage"]`). |
| `defaultConfig` | `object` | Default configuration values merged with DB-stored config at runtime. |
| `dependencies` | `string[]` | Module IDs that must be installed and enabled. |
| `conflicts` | `string[]` | Module IDs that cannot be active at the same time. |

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
| `path` | Yes | URL path. Supports dynamic segments (`[id]`, `[...params]`). |
| `component` | Yes | Path to the page component, relative to the module root. |
| `layout` | No | Optional layout wrapper component. |

### `adminRoutes` — Admin pages

Rendered at `/{locale}/admin/{path}` inside the admin layout (auth guard, sidebar, and header are provided automatically).

```json
"adminRoutes": [
    { "path": "/my-module", "component": "pages/admin/page.tsx" },
    { "path": "/my-module/settings", "component": "pages/admin/settings.tsx" }
]
```

| Field | Required | Description |
|-------|----------|-------------|
| `path` | Yes | Path relative to `/admin`. |
| `component` | Yes | Path to the component, relative to the module root. |

### `api` — API endpoints

Mounted at `/api/v1/{path}` via the `[...path]` catch-all that reads `ModuleApiRegistry`.

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
| `path` | Yes | Path under `/api/v1/`. |
| `handler` | Yes | Path to the handler file, relative to the module root. |
| `method` | No | `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, or `ALL`. Defaults to `ALL`. |
| `description` | No | OpenAPI summary — appears in the generated spec at `/api/v1/openapi`. |

### `menu` — Admin sidebar

```json
"menu": [
    { "label": "My Items", "path": "/my-module/items", "icon": "Package" },
    { "label": "Settings", "path": "/my-module/settings", "icon": "Settings" }
]
```

### `navLinks` — Public navbar links

```json
"navLinks": [
    { "label": "My Page", "href": "/my-page", "icon": "Star", "position": 50 }
]
```

Lower `position` values render further left.

### `footerLinks` — Footer links

```json
"footerLinks": [
    { "label": "My Page", "href": "/my-page", "section": "quick" }
]
```

`section` is `"quick"` or `"legal"`.

### `navbarComponents` — Navbar icons

Components rendered in the navbar's right-hand area (e.g. cart icon, notification bell).

```json
"navbarComponents": [
    { "id": "CartIcon", "component": "components/CartIcon", "order": 20 }
]
```

Lower `order` renders further left.

### `footerComponents` — Footer components

Components rendered in the footer alongside the language selector (e.g. currency selector).

```json
"footerComponents": [
    { "id": "CurrencySelector", "component": "components/CurrencySelector", "order": 10 }
]
```

### `layoutComponents` — Per-page components

Components rendered on every page when the module is enabled (toasts, banners, floating widgets). Support URL pattern filtering.

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

`include` and `exclude` are glob-style URL patterns. Omit both to render everywhere.

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

### `dashboardCards` — Admin dashboard stats

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

`labelKey` is an i18n key in the `admin` namespace — preferred over `label` when present.

### `statsApi` — Dashboard stats endpoint

```json
"statsApi": "/my-module/stats"
```

`GET /api/v1/my-module/stats` must return `{ cards: [...], sections: [...] }`. The dashboard reads this to populate `statKey` values.

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

### `profileTabs` — User profile tabs

```json
"profileTabs": [
    {
        "id": "my-history",
        "label": "History",
        "component": "components/ProfileHistory",
        "order": 5
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

`svgIcon` is raw SVG path data (`d` attribute value). `provider` must match a NextAuth provider ID.

### `contextProviders` — React context providers

Components that wrap the entire app tree. Use for global context (e.g. `CurrencyProvider`). Unlike `layoutComponents` (siblings), context providers wrap `children`.

```json
"contextProviders": [
    { "id": "CurrencyProvider", "component": "lib/context", "order": 10 }
]
```

Lower `order` = outer wrapper.

### `hookListeners` — Action/filter listeners

WordPress-style hooks. Declare listeners here; the registry auto-wires them when the module is enabled and removes them on disable.

```json
"hookListeners": [
    {
        "hook": "user.registered",
        "type": "action",
        "handler": "hooks/on-user-registered.ts",
        "priority": 10
    },
    {
        "hook": "post.content",
        "type": "filter",
        "handler": "hooks/filter-content.ts",
        "priority": 20
    }
]
```

- `type: "action"` — fire and forget. Handler exports `default (payload) => void | Promise<void>`.
- `type: "filter"` — value transformation. Handler exports `default (value, context?) => value`.
- `priority` — lower runs earlier. Default is 10.
- Async listeners have a per-listener timeout (default 5 s, overridable via `HOOK_LISTENER_TIMEOUT_MS` env).

Core-fired action hooks include `user.registered`, `module.enabled`, `module.disabled`. Modules can fire their own hooks via `doAction` / `applyFilters` from `@/core/lib/hooks`.

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

The `slot` value must match a slot name declared by a theme's `slots[]` array or by another module's `<Slot name="...">` usage.

### `pageBlocks` — Page-builder blocks

Module-contributed blocks available in the page editor.

```json
"pageBlocks": [
    {
        "id": "SliderHero",
        "category": "Slider",
        "component": "blocks/SliderHero.tsx"
    }
]
```

### `cronJobs` — Scheduled tasks

Periodic tasks run by the core scheduler.

```json
"cronJobs": [
    {
        "id": "currency-rate-refresh",
        "schedule": "every-hour",
        "handler": "cron/refresh.ts"
    }
]
```

Valid `schedule` keywords: `every-minute`, `every-5-minutes`, `every-15-minutes`, `every-hour`, `every-day`, `every-week`, `every-month`.

Handler file exports `default async function (): Promise<void>`.

### `searchProviders` — Site search

```json
"searchProviders": [
    {
        "id": "blog-search",
        "label": "Blog",
        "handler": "search/handler.ts"
    }
]
```

Handler exports `default async (query: string) => Promise<SearchResult[]>`. Results are dispatched by `GET /api/v1/search`.

### `webhookReceivers` — Inbound webhooks

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

Requests to `POST /api/v1/webhook/{provider}` are routed to the matching handler. When `signatureHeader` and `secretEnv` are set, HMAC verification runs automatically before the handler is called.

Handler exports `default async (request: Request) => Promise<{ status: number; body?: unknown }>`.

### `notificationTypes` — User notification preferences

Surfaces in the user preferences grid so users can opt out per channel.

```json
"notificationTypes": [
    {
        "eventType": "blog.article.created",
        "label": "New blog post",
        "channels": ["email", "inapp"]
    }
]
```

### `storageProviders` — File storage backends

Implement the `StorageProvider` interface from `@/core/lib/storage`. The active provider is selected via the `storage_active_provider` Setting key or `STORAGE_PROVIDER` env var.

```json
"storageProviders": [
    {
        "id": "cloudflare-r2",
        "name": "Cloudflare R2",
        "handler": "lib/provider.ts"
    }
]
```

Handler file exports `default: StorageProvider`.

### `seoRoutes` — Sitemap contributions

```json
"seoRoutes": {
    "handler": "seo/sitemap.ts"
}
```

Handler exports `default async () => Promise<SitemapEntry[]>`.

### `translations` — Bundled i18n strings

Translations merged into the `Translation` DB table on install and removed on uninstall. Admin-overridden rows survive uninstall.

```json
"translations": {
    "en": {
        "blog": {
            "title": "Blog",
            "readMore": "Read More"
        }
    },
    "tr": {
        "blog": {
            "title": "Blog",
            "readMore": "Devamını Oku"
        }
    }
}
```

Sync translations to the DB manually: `npx tsx scripts/seed-translations.ts`.

---

## Database Schema

### Adding models

Create `schema.prisma` in the module source directory:

```prisma
model MyItem {
    id        String   @id @default(cuid())
    name      String
    createdAt DateTime @default(now())
    user      User     @relation(fields: [userId], references: [id])
    userId    String
}
```

To add fields to the `User` model, use the comment-block mechanism:

```prisma
// @@user-relations-start
myItems MyItem[]
// @@user-relations-end
```

`scripts/merge-schemas.ts` injects these blocks into the core `User` model when building the merged `prisma/schema.prisma`. Do not redeclare core models.

After adding or changing `schema.prisma`:

```bash
npm run db:merge      # merge core + module schemas
npm run db:generate   # generate Prisma client
npm run db:push       # push to DB (dev) or migrate (prod)
```

### SQL migrations

Place migration files at `module-sources/<id>/migrations/*.sql`. `scripts/apply-migrations.ts` runs pending migrations (tracked in the `ModuleMigration` table, checksum-verified).

```bash
npx tsx scripts/apply-migrations.ts
```

---

## Writing Pages

### Public page

Server components are the default. Add `"use client"` only for hooks, event handlers, or browser APIs.

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

Key rules:
- Use `Link` and `usePathname` from `@/core/lib/i18n/navigation` (not `next/link`) for locale-aware routing.
- No hardcoded UI strings — use `useTranslations` (client) or `getTranslations` (server) from `next-intl`.
- No emojis in UI — use Lucide icons.
- No `confirm()` / `alert()` — use `useConfirm()` hook and `toast` from `sonner`.

### Public page with data fetching (client component)

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/core/components/ui/card";

interface Item {
    id: string;
    name: string;
}

export default function MyPage() {
    const [items, setItems] = useState<Item[]>([]);

    useEffect(() => {
        fetch("/api/v1/my-module/items")
            .then(res => res.json())
            .then(data => setItems(data.items ?? []));
    }, []);

    return (
        <main className="container mx-auto px-4 py-6">
            <div className="grid gap-4">
                {items.map(item => (
                    <Card key={item.id}>
                        <CardContent className="p-4">{item.name}</CardContent>
                    </Card>
                ))}
            </div>
        </main>
    );
}
```

### Admin page

Admin pages render inside the admin layout (auth guard, sidebar, header already provided). Export your content directly:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";

export default function MyAdminPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">My Module Management</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button>Create Item</Button>
                </CardContent>
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
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin, hasPermission } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";
import { z } from "zod";

// GET /api/v1/my-module/items
export async function GET() {
    const items = await prisma.myItem.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    return NextResponse.json({ items });
}

// POST /api/v1/my-module/items
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await hasPermission(session.user.id, "my-module.manage");
    if (!canManage) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const schema = z.object({ name: z.string().min(1).max(255) });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        // Zod 4: use .issues not .errors
        return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const item = await prisma.myItem.create({
        data: { name: parsed.data.name, userId: session.user.id },
    });

    await logActivity({ userId: session.user.id, action: "my-module.item.create", entityId: item.id });

    return NextResponse.json({ item }, { status: 201 });
}

// DELETE /api/v1/my-module/items/:id (admin only)
export async function DELETE(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await request.json();
    await prisma.myItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
```

API responses follow `{ data }` or `{ error, status }` conventions. Validation errors additionally include `issues`.

---

## Available Core Imports

```typescript
// Database
import { prisma } from "@/core/lib/db";

// Auth & permissions
import { auth } from "@/core/lib/auth";
import { isAdmin, isStaff, hasPermission, hasAnyPermission } from "@/core/lib/permissions";

// Zod 4 — use .issues not .errors
import { z } from "zod";

// Activity logging
import { logActivity } from "@/core/lib/activity-log";

// Discord webhooks
import { sendDiscordWebhook } from "@/core/lib/discord";

// Email
import { sendEmail } from "@/core/lib/email";

// Rate limiting
import { rateLimit, rateLimitForRole } from "@/core/lib/rate-limit";

// Hooks (action/filter system)
import { doAction, doActionAsync, applyFilters, applyFiltersAsync, addAction, addFilter } from "@/core/lib/hooks";

// i18n — navigation
import { Link, usePathname, redirect } from "@/core/lib/i18n/navigation";

// i18n — translations
import { useTranslations } from "next-intl";                    // client
import { getTranslations } from "next-intl/server";             // server

// Theme config
import { useThemeConfig } from "@/core/lib/theme-config-client"; // client only

// UI components
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
const result = await applyFiltersAsync("checkout.total", baseTotal, { cart });
```

**Registering listeners imperatively** (rarely needed — prefer `hookListeners` in the manifest):

```typescript
import { addAction, addFilter } from "@/core/lib/hooks";

addAction("user.registered", (payload) => { /* ... */ }, 10, "my-module");
addFilter("post.content", (html) => html.replace(/badword/g, "***"), 20, "my-module");
```

Listeners declared in `hookListeners` are wired at build time and automatically removed when the module is disabled or uninstalled.

---

## Packaging as ZIP

```bash
cd src/modules/my-module
zip -r my-module.zip .
```

The ZIP must contain `module.json` at its root level (or inside a single subdirectory).

Install via **Admin > Modules > Upload ZIP**.

The upload handler:
1. Extracts to a temp directory.
2. Validates `module.json` (schema + ID format).
3. Copies files to `src/modules/{id}/`.
4. Runs `scripts/generate-registry.ts`.
5. Creates the `ModuleConfig` DB record (enabled by default).
6. Rolls back on registry generation failure.

---

## Marketplace

The marketplace is hosted on GitHub. Admins install directly from **Admin > Modules > Marketplace**.

Marketplace installs are enabled by default. Bulk install is available at `POST /api/v1/modules/marketplace/bulk-install`.

---

## Module Lifecycle

| Event | What happens |
|-------|-------------|
| Install | Files extracted to `src/modules/<id>/`, registry regenerated, `ModuleConfig` row created (`enabled: true`). |
| Enable | Module appears in every UI surface: sidebar menu, navbar, homepage, dashboard, settings. Hook listeners, cron jobs, search providers, webhook receivers, slot contents — all active. |
| Disable | Module vanishes from all UI surfaces. Listeners, crons, and other runtime contributions removed. DB data preserved. |
| Uninstall | Files deleted, `ModuleConfig` row deleted, registry regenerated. Module translations removed (admin-overridden rows preserved). |

The DB (`ModuleConfig.enabled`) is the single source of truth for whether a module is active. Filesystem presence alone does not mean a module is enabled.

---

## Complete Example: Blog Module (abbreviated)

### `module.json`

```json
{
    "id": "blog",
    "name": "Blog Module",
    "description": "News and announcements system",
    "version": "1.0.0",
    "icon": "FileText",
    "permissions": ["blog.view", "blog.manage"],
    "routes": [
        { "path": "/blog", "component": "pages/page.tsx" },
        { "path": "/blog/[...params]", "component": "pages/[...params]/page.tsx" }
    ],
    "adminRoutes": [
        { "path": "/blog/articles", "component": "pages/admin/articles/page.tsx" },
        { "path": "/blog/articles/new", "component": "pages/admin/articles/new/page.tsx" }
    ],
    "api": [
        { "path": "/blog/articles", "handler": "api/articles/route.ts", "description": "List and create articles" },
        { "path": "/blog/articles/[id]", "handler": "api/articles/[id]/route.ts", "description": "Get, update, or delete an article" },
        { "path": "/blog/stats", "handler": "api/stats/route.ts", "description": "Dashboard statistics" }
    ],
    "menu": [
        { "label": "Articles", "path": "/blog/articles", "icon": "FileText" },
        { "label": "Categories", "path": "/blog/categories", "icon": "FolderOpen" }
    ],
    "dashboardCards": [
        {
            "id": "articles",
            "label": "Articles",
            "labelKey": "dashboard_articles",
            "icon": "FileText",
            "href": "/admin/blog/articles",
            "color": "text-indigo-600",
            "statKey": "articles"
        }
    ],
    "statsApi": "/blog/stats",
    "homepageSections": [
        { "id": "BlogNewsSection", "type": "content", "component": "components/BlogNewsSection", "order": 10 }
    ],
    "searchProviders": [
        { "id": "blog-search", "label": "Blog", "handler": "search/handler.ts" }
    ],
    "notificationTypes": [
        { "eventType": "blog.article.created", "label": "New blog post", "channels": ["email", "inapp"] }
    ],
    "pageBlocks": [
        { "id": "BlogLatestPosts", "category": "Blog", "component": "blocks/BlogLatestPosts.tsx" }
    ],
    "seoRoutes": { "handler": "seo/sitemap.ts" },
    "translations": {
        "en": { "blog": { "title": "Blog", "readMore": "Read More" } },
        "tr": { "blog": { "title": "Blog", "readMore": "Devamını Oku" } }
    }
}
```

### `api/articles/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { hasPermission } from "@/core/lib/permissions";

export async function GET() {
    const articles = await prisma.blogArticle.findMany({
        where: { status: "published" },
        orderBy: { publishedAt: "desc" },
        take: 20,
    });
    return NextResponse.json({ articles });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await hasPermission(session.user.id, "blog.manage"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const article = await prisma.blogArticle.create({
        data: { title: body.title, content: body.content, authorId: session.user.id, status: "draft" },
    });
    return NextResponse.json({ article }, { status: 201 });
}
```

### Activate

```bash
npx tsx scripts/generate-registry.ts
npm run dev
```

Visit `http://localhost:3001/en/blog` for the public page and `http://localhost:3001/en/admin/blog/articles` for the admin page.

---

## Conventions Checklist

- No `any` types — use proper TypeScript types.
- Zod 4: use `.issues` not `.errors` on `SafeParseError`.
- ES imports only — no `require()`.
- Path alias `@/*` resolves to `src/*`.
- `Link`, `usePathname`, `redirect` from `@/core/lib/i18n/navigation` — not `next/link`.
- `"use client"` only when the component needs browser APIs, hooks, or event handlers.
- Lucide icons only in UI — no emoji.
- `useConfirm()` + `toast` from `sonner` — no `confirm()` or `alert()`.
- API responses: `{ data }` on success, `{ error }` on failure, `{ error, issues }` on validation failure.
- Dark mode: `data-mode="dark"` attribute on a container element, CSS variables for theming.
