# uxwVend Plugin SDK

## Creating a Module

Modules are self-contained features in `/src/modules/[name]/`. Each module needs:

### 1. module.json (Manifest)

```json
{
    "id": "my-module",
    "name": "My Module",
    "description": "What this module does",
    "version": "1.0.0",
    "author": "Your Name",
    "icon": "Star",
    "permissions": ["mymodule.view", "mymodule.manage"],
    "defaultConfig": {
        "setting1": true,
        "setting2": "value"
    },
    "menu": [
        { "label": "My Feature", "path": "/my-feature", "icon": "Star" }
    ],
    "routes": [
        { "path": "/my-page", "component": "pages/public/page.tsx" }
    ],
    "adminRoutes": [
        { "path": "/my-feature", "component": "pages/admin/page.tsx" }
    ],
    "api": [
        { "path": "/my-module/items", "handler": "api/items/route.ts" }
    ]
}
```

### 2. Directory Structure

```
src/modules/my-module/
├── module.json              # Required: manifest
├── pages/
│   ├── public/
│   │   └── page.tsx         # Public page at /my-page
│   └── admin/
│       └── page.tsx         # Admin page at /admin/my-feature
└── api/
    └── items/
        └── route.ts         # API at /api/v1/my-module/items
```

### 3. API Route Example

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

export async function GET() {
    // Public endpoint
    const items = await prisma.myModel.findMany();
    return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
    // Auth required
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // ... create item
}
```

### 4. Page Component Example

```tsx
"use client";

import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";

export default function MyPage() {
    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />
            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Your content */}
            </main>
            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
```

### 5. Activate Module

After creating your module:

```bash
npx tsx scripts/generate-registry.ts
```

This auto-discovers your module and generates the import registry.

### Available Imports

```typescript
// Database
import { prisma } from "@/core/lib/db";

// Auth & Permissions
import { auth } from "@/core/lib/auth";
import { isAdmin, hasPermission } from "@/core/lib/permissions";

// Email
import { sendOrderConfirmationEmail } from "@/core/lib/email";

// Discord (generic webhook — pass event type and embed payload)
import { sendDiscordWebhook } from "@/core/lib/discord";

// RCON
import { sendRconCommand } from "@/core/lib/rcon";

// Activity Log
import { logActivity } from "@/core/lib/activity-log";

// UI Components
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";

// Theme Integration
import { ThemeSlot } from "@/core/components/theme-slot";

// i18n
import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";

// Currency
import { useCurrency } from "@/core/lib/currency/context";
```

### Icons

Available icons for `module.json` menu items:
`LayoutDashboard`, `Package`, `ShoppingCart`, `FileText`, `FolderOpen`, `Users`, `Settings`, `Puzzle`, `Ticket`, `HelpCircle`, `Shield`, `Tag`, `Star`, `Download`, `Gift`, `Crown`, `MessageSquare`
