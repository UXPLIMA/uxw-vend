import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";

const MARKETPLACE_URL = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/module-marketplace/index.json";
const MODULES_DIR = path.join(process.cwd(), "src/modules");

interface MarketplaceModule {
    id: string;
    name: string;
    version: string;
    description?: string;
    zip?: string;
}

interface MarketplaceIndex {
    modules: MarketplaceModule[];
}

interface UpdateInfo {
    moduleId: string;
    name: string;
    installedVersion: string;
    latestVersion: string;
    description?: string;
}

/**
 * Compare two semver-ish version strings.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 * Handles "1.2.3", "1.2", "1" — missing parts treated as 0.
 */
function compareVersions(a: string, b: string): number {
    const ap = a.split(".").map((n) => parseInt(n) || 0);
    const bp = b.split(".").map((n) => parseInt(n) || 0);
    for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
        const av = ap[i] || 0;
        const bv = bp[i] || 0;
        if (av !== bv) return av - bv;
    }
    return 0;
}

/**
 * GET /api/v1/modules/updates
 * Returns the list of installed modules that have a newer version available
 * in the marketplace index.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let marketplace: MarketplaceIndex;
    try {
        const res = await fetch(MARKETPLACE_URL, { next: { revalidate: 300 } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        marketplace = await res.json();
    } catch (err) {
        return NextResponse.json({
            error: "Failed to fetch marketplace",
            details: err instanceof Error ? err.message : "unknown",
            updates: [],
        }, { status: 502 });
    }

    const marketplaceMap = new Map<string, MarketplaceModule>();
    for (const m of marketplace.modules || []) {
        marketplaceMap.set(m.id, m);
    }

    // Walk installed modules
    let installedDirs: string[] = [];
    try {
        const entries = await fs.readdir(MODULES_DIR, { withFileTypes: true });
        installedDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
        return NextResponse.json({ updates: [] });
    }

    const updates: UpdateInfo[] = [];

    for (const moduleId of installedDirs) {
        const manifestPath = path.join(MODULES_DIR, moduleId, "module.json");
        try {
            const content = await fs.readFile(manifestPath, "utf-8");
            const manifest = JSON.parse(content);
            const installedVersion = manifest.version || "0.0.0";

            const market = marketplaceMap.get(moduleId);
            if (!market) continue; // Not in marketplace — custom module

            if (compareVersions(market.version, installedVersion) > 0) {
                updates.push({
                    moduleId,
                    name: manifest.name || moduleId,
                    installedVersion,
                    latestVersion: market.version,
                    description: market.description,
                });
            }
        } catch {
            // Skip modules with broken manifests
        }
    }

    return NextResponse.json({
        updates,
        count: updates.length,
        checkedAt: new Date().toISOString(),
    });
}
