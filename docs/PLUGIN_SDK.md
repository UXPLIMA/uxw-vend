# uxwVend Plugin SDK

## Overview

uxwVend uses a file-based module system. Every feature (store, blog, forum, support, payments) is a self-contained module in `/src/modules/[name]/`. The platform ships with no modules installed -- all functionality comes from modules.

Modules are auto-discovered at build time. A build script reads each module's `module.json` manifest and generates dynamic import registries. At runtime, middleware blocks routes for disabled modules.

---

## Creating a Module

### 1. Create the directory

```
src/modules/hello-world/
```

### 2. Create `module.json`

Every module needs a `module.json` manifest in its root directory. This is the only required file.

```json
{
    "id": "hello-world",
    "name": "Hello World",
    "description": "A simple greeting module",
    "version": "1.0.0",
    "author": "Your Name",
    "icon": "Star"
}
```

### 3. Regenerate the registry

```bash
npx tsx scripts/generate-registry.ts
```

This scans `/src/modules/`, reads every `module.json`, and generates:
- `src/core/generated/module-registry.tsx` -- dynamic imports for all components and API handlers
- `src/core/generated/module-routes.ts` -- route patterns for middleware gating

You must run this after any change to `module.json` or after adding/removing route files.

---

## Directory Structure

```
src/modules/hello-world/
├── module.json              # Required: manifest
├── pages/
│   ├── public/
│   │   └── page.tsx         # Public page component
│   └── admin/
│       └── page.tsx         # Admin page component
├── api/
│   └── greetings/
│       └── route.ts         # API route handler
├── components/              # Module-specific components
│   └── GreetingCard.tsx
└── lib/                     # Module-specific utilities
    └── helpers.ts
```

Only `module.json` is required. Everything else is optional -- include only what your module needs.

---

## module.json Manifest Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier. Lowercase letters, numbers, hyphens only. Must match directory name. |
| `name` | `string` | Human-readable display name. |
| `description` | `string` | Short description shown in admin module manager. |
| `version` | `string` | Semver version string (e.g. `"1.0.0"`). |

### Optional Metadata

| Field | Type | Description |
|-------|------|-------------|
| `author` | `string` | Author name. |
| `icon` | `string` | Lucide icon name for admin sidebar (e.g. `"ShoppingCart"`, `"FileText"`). |
| `permissions` | `string[]` | Permission strings this module registers (e.g. `["store.view", "store.manage"]`). |
| `defaultConfig` | `object` | Default configuration values. Merged with DB-stored config at runtime. |
| `dependencies` | `string[]` | Module IDs that must be installed and enabled (e.g. `["store"]`). |
| `conflicts` | `string[]` | Module IDs that cannot be active at the same time. |

### Routes

**`routes`** -- Public pages (rendered at `/{locale}/{path}`):

```json
"routes": [
    { "path": "/hello", "component": "pages/public/page.tsx" },
    { "path": "/hello/[id]", "component": "pages/public/detail.tsx", "layout": "pages/public/layout.tsx" }
]
```

| Field | Required | Description |
|-------|----------|-------------|
| `path` | Yes | URL path. Supports dynamic segments like `[id]`. |
| `component` | Yes | Relative path to the component file from module root. |
| `layout` | No | Optional layout component wrapping this route. |

**`adminRoutes`** -- Admin pages (rendered at `/{locale}/admin/{path}`):

```json
"adminRoutes": [
    { "path": "/hello", "component": "pages/admin/page.tsx" },
    { "path": "/hello/settings", "component": "pages/admin/settings.tsx" }
]
```

| Field | Required | Description |
|-------|----------|-------------|
| `path` | Yes | Path relative to `/admin`. e.g. `"/hello"` becomes `/admin/hello`. |
| `component` | Yes | Relative path to the component file from module root. |

**`api`** -- API endpoints (mounted at `/api/v1/{path}`):

```json
"api": [
    { "path": "/hello/greetings", "handler": "api/greetings/route.ts" },
    { "path": "/hello/greetings", "handler": "api/greetings/route.ts", "method": "POST" }
]
```

| Field | Required | Description |
|-------|----------|-------------|
| `path` | Yes | API path under `/api/v1/`. |
| `handler` | Yes | Relative path to the route handler file. |
| `method` | No | HTTP method (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `ALL`). Defaults to `"ALL"`. |

### Admin Sidebar Menu

```json
"menu": [
    { "label": "Hello World", "path": "/hello", "icon": "Star" },
    { "label": "Hello Settings", "path": "/hello/settings", "icon": "Settings" }
]
```

| Field | Required | Description |
|-------|----------|-------------|
| `label` | Yes | Menu item text. |
| `path` | Yes | Path relative to `/admin`. |
| `icon` | No | Lucide icon name. |

### Navbar and Layout Integration

**`navLinks`** -- Links added to the public navbar:

```json
"navLinks": [
    { "label": "Hello", "href": "/hello", "icon": "Star", "position": 5 }
]
```

**`footerLinks`** -- Links added to the footer:

```json
"footerLinks": [
    { "label": "Hello", "href": "/hello", "section": "quick" }
]
```

`section` can be `"quick"` or `"legal"`.

**`navbarComponents`** -- Components rendered in the navbar's right side (e.g. cart icon, notification bell):

```json
"navbarComponents": [
    { "id": "HelloBell", "component": "components/HelloBell.tsx", "order": 10 }
]
```

Lower `order` values render further left.

**`layoutComponents`** -- Components rendered on every page when the module is enabled (e.g. toast notifications, floating widgets):

```json
"layoutComponents": [
    { "id": "HelloToast", "component": "components/HelloToast.tsx" }
]
```

Components can also reference core components using the `@core/` prefix:

```json
{ "id": "LivePurchaseToast", "component": "@core/layout/LivePurchaseToast" }
```

### Widgets

Sidebar widgets for the homepage:

```json
"widgets": [
    {
        "id": "HelloWidget",
        "component": "components/HelloWidget.tsx",
        "defaultOrder": 5,
        "defaultVisible": true
    }
]
```

### Homepage Sections

Content sections rendered on the homepage:

```json
"homepageSections": [
    {
        "id": "HelloSection",
        "type": "content",
        "component": "components/HelloSection.tsx",
        "order": 3
    }
]
```

`type` is `"content"` (main area) or `"widget"` (sidebar).

### Dashboard Cards

Stat cards shown on the admin dashboard:

```json
"dashboardCards": [
    {
        "id": "hello-count",
        "label": "Greetings",
        "icon": "Star",
        "href": "/admin/hello",
        "color": "text-yellow-500",
        "statKey": "greetingsCount"
    }
]
```

**`statsApi`** -- Endpoint that returns dashboard statistics for this module:

```json
"statsApi": "/hello/stats"
```

The endpoint (`GET /api/v1/hello/stats`) should return `{ cards: [...], sections: [...] }`.

### Settings Cards

Buttons added to the admin settings page:

```json
"settingsCards": [
    {
        "title": "Hello Settings",
        "description": "Configure greeting behavior.",
        "href": "/settings/hello",
        "icon": "Star",
        "color": "text-yellow-500"
    }
]
```

### Profile Tabs

Tabs added to user profile pages:

```json
"profileTabs": [
    {
        "id": "hello-history",
        "label": "Greetings",
        "component": "components/ProfileGreetings.tsx",
        "order": 5
    }
]
```

### OAuth Buttons

Login/register buttons for OAuth providers:

```json
"oauthButtons": [
    {
        "id": "discord-login",
        "provider": "discord",
        "label": "Discord",
        "color": "#5865F2",
        "svgIcon": "M20.3 ..."
    }
]
```

### Lifecycle Hooks

```json
"hooks": {
    "onEnable": "lib/on-enable.ts",
    "onDisable": "lib/on-disable.ts"
}
```

Scripts executed when the module is enabled or disabled.

---

## Writing Pages

### Public Page

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";

export default function HelloPage() {
    const t = useTranslations();

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />
            <main className="container mx-auto px-4 py-6 flex-1">
                <h1 className="text-2xl font-bold">Hello World</h1>
                <Link href="/hello/about">About</Link>
            </main>
            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
```

Key rules:
- Use `"use client"` only when the component needs hooks, event handlers, or browser APIs. Server components are the default.
- Use `Link` and `usePathname` from `@/core/lib/i18n/navigation` (not `next/link`) for locale-aware routing.
- Use `useTranslations()` from `next-intl` for all UI text. No hardcoded strings.
- Use `ThemeSlot` to allow themes to override layout components.

### Admin Page

Admin pages render inside the admin layout (which provides its own auth guard, sidebar, and header). Just export your content:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";

export default function HelloAdminPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Hello Management</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Greetings</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Manage your greetings here.</p>
                    <Button>Create Greeting</Button>
                </CardContent>
            </Card>
        </div>
    );
}
```

---

## Writing API Routes

API handlers follow the Next.js App Router convention. Export named functions for each HTTP method:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";

// GET /api/v1/hello/greetings
export async function GET() {
    const greetings = await prisma.greeting.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    return NextResponse.json({ greetings });
}

// POST /api/v1/hello/greetings
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    // Validate with Zod (use .issues not .errors for Zod 4)

    const greeting = await prisma.greeting.create({
        data: { message: body.message, userId: session.user.id },
    });

    await logActivity(session.user.id, "greeting.create", { greetingId: greeting.id });

    return NextResponse.json({ greeting }, { status: 201 });
}

// DELETE /api/v1/hello/greetings (admin only)
export async function DELETE(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await request.json();
    await prisma.greeting.delete({ where: { id } });

    return NextResponse.json({ message: "Deleted" });
}
```

---

## Available Core Imports

```typescript
// Database
import { prisma } from "@/core/lib/db";

// Auth & Permissions
import { auth } from "@/core/lib/auth";
import { isAdmin, isStaff, hasPermission } from "@/core/lib/permissions";

// Validation (Zod 4 -- use .issues not .errors)
import { z } from "zod";

// Email
import { sendOrderConfirmationEmail } from "@/core/lib/email";

// Discord webhooks
import { sendDiscordWebhook } from "@/core/lib/discord";

// RCON game server commands
import { sendRconCommand } from "@/core/lib/rcon";

// Activity logging
import { logActivity } from "@/core/lib/activity-log";

// Notifications
import { createNotification } from "@/core/lib/notifications";

// Rate limiting
import { rateLimit } from "@/core/lib/rate-limit";

// i18n
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/core/lib/i18n/navigation";

// Currency
import { useCurrency } from "@/core/lib/currency/context";

// Theme integration
import { ThemeSlot } from "@/core/components/theme-slot";

// UI components
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";
```

---

## Available Icons

These Lucide icon names can be used in `module.json` for `icon`, `menu[].icon`, `navLinks[].icon`, `dashboardCards[].icon`, and `settingsCards[].icon`:

`LayoutDashboard`, `Package`, `ShoppingCart`, `FileText`, `FolderOpen`, `Users`, `Settings`, `Puzzle`, `Ticket`, `HelpCircle`, `Shield`, `Tag`, `Star`, `Download`, `Gift`, `Crown`, `MessageSquare`, `CreditCard`

---

## Dependencies and Conflicts

```json
{
    "dependencies": ["store"],
    "conflicts": ["legacy-payments"]
}
```

- **dependencies**: The listed modules must be installed and enabled. If a dependency is missing or disabled, the platform will warn the admin.
- **conflicts**: The listed modules cannot be active at the same time. Enabling this module requires disabling conflicting ones.

Example: a `stripe-gateway` module depends on `store` because it provides payment processing for store checkout.

---

## Packaging as ZIP

To distribute your module:

1. ZIP the module directory contents (not the parent directory):

```bash
cd src/modules/hello-world
zip -r hello-world.zip .
```

The ZIP should contain `module.json` at the root level (or inside a single subdirectory).

2. The admin can install it via **Admin > Modules > Upload ZIP**.

The upload handler:
- Extracts the ZIP to a temp directory
- Finds and validates `module.json` (requires `id`, `name`, `version`)
- Validates the ID format (lowercase, numbers, hyphens only)
- Copies files to `src/modules/{id}/`
- Runs `npx tsx scripts/generate-registry.ts`
- Creates a database record (disabled by default)
- Rolls back if registry generation fails

---

## Publishing to the Marketplace

The uxwVend marketplace is hosted on GitHub. To publish:

1. Ensure your module has a valid `module.json` with all required fields.
2. Package as a ZIP file.
3. Submit your module ZIP to the marketplace repository.

Admins can install marketplace modules directly from the **Admin > Modules > Marketplace** tab. Marketplace installs are enabled by default.

---

## Complete Example: Hello World Module

### `src/modules/hello-world/module.json`

```json
{
    "id": "hello-world",
    "name": "Hello World",
    "description": "A simple greeting page with admin management",
    "version": "1.0.0",
    "author": "Your Name",
    "icon": "Star",
    "permissions": ["hello.view", "hello.manage"],
    "routes": [
        { "path": "/hello", "component": "pages/public/page.tsx" }
    ],
    "adminRoutes": [
        { "path": "/hello", "component": "pages/admin/page.tsx" }
    ],
    "api": [
        { "path": "/hello/greetings", "handler": "api/greetings/route.ts" }
    ],
    "menu": [
        { "label": "Hello World", "path": "/hello", "icon": "Star" }
    ],
    "navLinks": [
        { "label": "Hello", "href": "/hello", "icon": "Star", "position": 10 }
    ],
    "dashboardCards": [
        {
            "id": "hello-count",
            "label": "Greetings",
            "icon": "Star",
            "href": "/admin/hello",
            "color": "text-yellow-500",
            "statKey": "greetingsCount"
        }
    ]
}
```

### `src/modules/hello-world/pages/public/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";

interface Greeting {
    id: string;
    message: string;
    createdAt: string;
}

export default function HelloPage() {
    const [greetings, setGreetings] = useState<Greeting[]>([]);

    useEffect(() => {
        fetch("/api/v1/hello/greetings")
            .then(res => res.json())
            .then(data => setGreetings(data.greetings || []));
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />
            <main className="container mx-auto px-4 py-6 flex-1">
                <h1 className="text-2xl font-bold mb-4">Hello World</h1>
                <div className="grid gap-4">
                    {greetings.map(g => (
                        <Card key={g.id}>
                            <CardContent className="p-4">{g.message}</CardContent>
                        </Card>
                    ))}
                </div>
            </main>
            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
```

### `src/modules/hello-world/pages/admin/page.tsx`

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";

export default function HelloAdminPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Hello World Management</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Greetings</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Manage greetings from here.</p>
                    <Button className="mt-4">Add Greeting</Button>
                </CardContent>
            </Card>
        </div>
    );
}
```

### `src/modules/hello-world/api/greetings/route.ts`

```typescript
import { NextResponse } from "next/server";

const greetings = [
    { id: "1", message: "Hello from uxwVend!", createdAt: new Date().toISOString() },
];

export async function GET() {
    return NextResponse.json({ greetings });
}
```

### Activate

```bash
npx tsx scripts/generate-registry.ts
npm run dev
```

Visit `http://localhost:3000/en/hello` to see the public page and `http://localhost:3000/en/admin/hello` to see the admin page.
