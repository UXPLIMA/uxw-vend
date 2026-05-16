import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { applyFiltersAsync } from "@/core/lib/hooks";
import { ModuleSettingsCards, ModuleRoutes } from "@/core/generated/module-registry";

interface SearchResult {
    type: string;
    id: string;
    title: string;
    subtitle?: string;
    href: string;
    icon?: string;
    score?: number;
}

// Admin nav items — kept here so search can find them.
// Mirrors AdminSidebar's coreNavDefs labels but flat.
const STATIC_ADMIN_PAGES: { title: string; href: string; keywords: string[] }[] = [
    { title: "Dashboard", href: "/admin", keywords: ["home", "stats"] },
    { title: "Module Marketplace", href: "/admin/modules", keywords: ["plugins", "extensions", "install"] },
    { title: "Users", href: "/admin/users", keywords: ["accounts", "members"] },
    { title: "Roles", href: "/admin/roles", keywords: ["roles", "groups"] },
    { title: "Permissions", href: "/admin/permissions", keywords: ["permissions", "rbac", "matrix"] },
    { title: "Activity Log", href: "/admin/activity-log", keywords: ["audit", "history"] },
    { title: "System Health", href: "/admin/system", keywords: ["health", "monitoring"] },
    { title: "API Keys", href: "/admin/api-keys", keywords: ["api", "tokens"] },
    { title: "Media Library", href: "/admin/media", keywords: ["files", "uploads", "images"] },
    { title: "Settings", href: "/admin/settings", keywords: ["config"] },
    { title: "Appearance", href: "/admin/settings/theme", keywords: ["theme", "library", "modes"] },
    { title: "Navbar Editor", href: "/admin/settings/navbar", keywords: ["menu", "navigation"] },
];

function score(text: string, query: string): number {
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(q)) return 60;
    // Word match
    const words = t.split(/\s+/);
    if (words.some((w) => w.startsWith(q))) return 40;
    return 0;
}

// GET /api/v1/admin/search?q=... — Cross-module spotlight search
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const q = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (q.length < 2) return NextResponse.json({ results: [] });

    const results: SearchResult[] = [];

    // 1. Static admin pages
    for (const page of STATIC_ADMIN_PAGES) {
        const titleScore = score(page.title, q);
        const keywordScore = page.keywords.reduce((max, k) => Math.max(max, score(k, q)), 0);
        const s = Math.max(titleScore, keywordScore);
        if (s > 0) {
            results.push({ type: "page", id: page.href, title: page.title, href: page.href, score: s });
        }
    }

    // 2. Module settings cards
    for (const card of ModuleSettingsCards) {
        const s = score(card.title, q);
        if (s > 0) {
            results.push({ type: "settings", id: card.href, title: card.title, subtitle: card.description, href: `/admin${card.href}`, score: s });
        }
    }

    // 3. Module routes (admin)
    for (const route of ModuleRoutes) {
        if (!route.isAdmin) continue;
        const s = score(route.path, q);
        if (s > 0) {
            results.push({ type: "module-page", id: route.key, title: route.path.split("/").pop() || route.path, subtitle: route.module, href: `/admin${route.path}`, score: s });
        }
    }

    // 4. Users (top 5)
    try {
        const users = await prisma.user.findMany({
            where: { OR: [
                { username: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
            ] },
            select: { id: true, username: true, email: true },
            take: 5,
        });
        for (const u of users) {
            results.push({
                type: "user",
                id: u.id,
                title: u.username,
                subtitle: u.email,
                href: `/admin/users/${u.id}`,
                score: 50,
            });
        }
    } catch { /* ignore */ }

    // 5. Modules can extend via hook filter
    const extended = await applyFiltersAsync<SearchResult[], { query: string }>("admin.search.results", results, { query: q });

    // Sort by score, dedupe by href
    const seen = new Set<string>();
    const unique = extended
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .filter((r) => {
            if (seen.has(r.href)) return false;
            seen.add(r.href);
            return true;
        })
        .slice(0, 20);

    return NextResponse.json({ results: unique });
}
