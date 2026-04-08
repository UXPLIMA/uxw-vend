import Link from "next/link";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import fs from "fs/promises";
import path from "path";
import { UpdateBannerDismiss } from "./UpdateBannerDismiss";

const LOCAL_INDEX_PATH = path.join(process.cwd(), "module-marketplace", "index.json");
const REMOTE_INDEX = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/module-marketplace/index.json";
const MODULES_DIR = path.join(process.cwd(), "src/modules");

interface MinimalModule {
    id: string;
    version: string;
}
interface MinimalIndex {
    modules: MinimalModule[];
}

/**
 * Strict-enough semver comparison for "1.2.3" style strings. Returns a
 * positive number when a > b, negative when a < b, and 0 when equal.
 * Missing components (e.g. "1.2") are treated as zero.
 */
function compareVersions(a: string, b: string): number {
    const ap = a.split(".").map((n) => parseInt(n, 10) || 0);
    const bp = b.split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
        const av = ap[i] || 0;
        const bv = bp[i] || 0;
        if (av !== bv) return av - bv;
    }
    return 0;
}

async function loadMarketplace(): Promise<MinimalIndex | null> {
    try {
        const raw = await fs.readFile(LOCAL_INDEX_PATH, "utf-8");
        return JSON.parse(raw) as MinimalIndex;
    } catch { /* fall through */ }
    try {
        const res = await fetch(REMOTE_INDEX, { next: { revalidate: 300 } });
        if (!res.ok) return null;
        return (await res.json()) as MinimalIndex;
    } catch {
        return null;
    }
}

async function countAvailableUpdates(): Promise<number> {
    const marketplace = await loadMarketplace();
    if (!marketplace) return 0;
    const marketMap = new Map<string, string>();
    for (const m of marketplace.modules || []) marketMap.set(m.id, m.version);

    let installedDirs: string[] = [];
    try {
        const entries = await fs.readdir(MODULES_DIR, { withFileTypes: true });
        installedDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
        return 0;
    }

    let updates = 0;
    for (const moduleId of installedDirs) {
        try {
            const raw = await fs.readFile(path.join(MODULES_DIR, moduleId, "module.json"), "utf-8");
            const manifest = JSON.parse(raw) as { version?: string };
            const installed = manifest.version || "0.0.0";
            const latest = marketMap.get(moduleId);
            if (latest && compareVersions(latest, installed) > 0) updates++;
        } catch { /* skip broken manifest */ }
    }
    return updates;
}

/**
 * Server component. Renders a dismissible banner at the top of the admin
 * shell when at least one installed module has a newer version available in
 * the marketplace. Falls back to rendering nothing on any failure.
 */
export async function UpdateNotificationBanner() {
    const session = await auth();
    if (!session?.user?.id) return null;
    if (!(await isAdmin(session.user.id, session.user.role))) return null;

    // Silence banner entirely when no installed modules exist (fresh install).
    const installedCount = await prisma.moduleConfig.count();
    if (installedCount === 0) return null;

    let count = 0;
    try {
        count = await countAvailableUpdates();
    } catch {
        return null;
    }
    if (count === 0) return null;

    return (
        <UpdateBannerDismiss count={count}>
            <Link
                href="/admin/modules/marketplace?filter=updates"
                className="underline font-semibold hover:no-underline"
            >
                View
            </Link>
        </UpdateBannerDismiss>
    );
}
