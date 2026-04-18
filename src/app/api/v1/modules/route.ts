import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import moduleSystem from "@/core/lib/modules";
import { invalidateModuleCache } from "@/core/lib/module-cache";
import path from "path";

const MARKETPLACE_URL = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/module-marketplace/index.json";

// Cache marketplace index for update checks
let marketplaceCache: { modules: Array<{ id: string; version: string }> } | null = null;
let marketplaceCacheTime = 0;
const MARKETPLACE_CACHE_TTL = 5 * 60 * 1000;

async function fetchMarketplaceIndex(): Promise<Map<string, string>> {
    const now = Date.now();
    if (marketplaceCache && now - marketplaceCacheTime < MARKETPLACE_CACHE_TTL) {
        return new Map(marketplaceCache.modules.map(m => [m.id, m.version]));
    }
    try {
        const res = await fetch(MARKETPLACE_URL, { next: { revalidate: 300 } });
        if (!res.ok) return new Map();
        const data = await res.json();
        marketplaceCache = data;
        marketplaceCacheTime = now;
        return new Map((data.modules as Array<{ id: string; version: string }>).map(m => [m.id, m.version]));
    } catch {
        if (marketplaceCache) {
            return new Map(marketplaceCache.modules.map(m => [m.id, m.version]));
        }
        return new Map();
    }
}

function isNewerVersion(current: string, latest: string): boolean {
    const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
    const c = parse(current);
    const l = parse(latest);
    for (let i = 0; i < Math.max(c.length, l.length); i++) {
        const cv = c[i] ?? 0;
        const lv = l[i] ?? 0;
        if (lv > cv) return true;
        if (lv < cv) return false;
    }
    return false;
}

// GET /api/v1/modules - Get all modules with their status (admin only)
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const definitions = moduleSystem.getDefinitions();
    const configs = await prisma.moduleConfig.findMany();
    const configMap = new Map(configs.map(c => [c.id, c]));

    // Fetch marketplace versions for update checks
    const marketplaceVersions = await fetchMarketplaceIndex();

    const modules = definitions.map(def => {
        const latestVersion = marketplaceVersions.get(def.id);
        const updateAvailable = latestVersion ? isNewerVersion(def.version, latestVersion) : false;
        return {
            ...def,
            enabled: configMap.get(def.id)?.enabled ?? true,
            config: {
                ...def.defaultConfig,
                ...(configMap.get(def.id)?.config as object || {}),
            },
            updateAvailable,
            latestVersion: latestVersion ?? null,
        };
    });

    return NextResponse.json({ modules });
}

// PATCH /api/v1/modules - Update module status
export async function PATCH(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { moduleId, enabled, config } = body;

    if (!moduleId) {
        return NextResponse.json({ error: "Module ID required" }, { status: 400 });
    }

    const definition = moduleSystem.getDefinition(moduleId);
    if (!definition) {
        return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const wantEnabled = enabled ?? true;

    // Single DB query for all module configs — used for dependency/conflict resolution
    const allConfigs = await prisma.moduleConfig.findMany();
    const configMap = new Map(allConfigs.map(c => [c.id, c]));
    const allDefs = moduleSystem.getDefinitions();

    // --- Dependency resolution ---
    if (wantEnabled) {
        // When enabling: check that all dependencies are enabled
        const deps = definition.dependencies ?? [];
        if (deps.length > 0) {
            const missingDeps: string[] = [];

            for (const dep of deps) {
                const depDef = moduleSystem.getDefinition(dep);
                if (!depDef) {
                    missingDeps.push(dep);
                    continue;
                }
                const depConfig = configMap.get(dep);
                if (depConfig && !depConfig.enabled) {
                    missingDeps.push(dep);
                }
            }

            if (missingDeps.length > 0) {
                return NextResponse.json({
                    error: `Cannot enable '${moduleId}': requires module '${missingDeps[0]}' to be enabled first`,
                    missingDeps,
                }, { status: 400 });
            }
        }

        // When enabling: check for conflicts
        const conflicts = definition.conflicts ?? [];
        if (conflicts.length > 0) {
            const activeConflicts = conflicts.filter(cId => configMap.get(cId)?.enabled === true);
            if (activeConflicts.length > 0) {
                const conflictNames = activeConflicts.map(cId => moduleSystem.getDefinition(cId)?.name || cId);
                return NextResponse.json({
                    error: `Cannot enable '${definition.name}': incompatible with ${conflictNames.join(', ')}`,
                    conflicts: activeConflicts,
                }, { status: 400 });
            }
        }

        // Also check if any enabled module declares conflict with this one
        for (const def of allDefs) {
            if (def.id === moduleId) continue;
            const theirConflicts = def.conflicts ?? [];
            if (theirConflicts.includes(moduleId)) {
                if (configMap.get(def.id)?.enabled === true) {
                    return NextResponse.json({
                        error: `Cannot enable '${definition.name}': incompatible with ${def.name}`,
                        conflicts: [def.id],
                    }, { status: 400 });
                }
            }
        }
    } else {
        // When disabling: check if any enabled module depends on this one
        const dependents: string[] = [];

        for (const def of allDefs) {
            if (def.id === moduleId) continue;
            const deps = def.dependencies ?? [];
            if (!deps.includes(moduleId)) continue;
            // Check if this dependent module is enabled
            const depConfig = configMap.get(def.id);
            const isEnabled = depConfig ? depConfig.enabled : true;
            if (isEnabled) {
                dependents.push(def.id);
            }
        }

        if (dependents.length > 0) {
            const force = body.force === true;
            if (!force) {
                return NextResponse.json({
                    error: `Cannot disable '${moduleId}': module '${dependents[0]}' depends on it`,
                    dependents,
                }, { status: 400 });
            }

            // Force mode: cascade-disable all dependents
            for (const depId of dependents) {
                const depDef = moduleSystem.getDefinition(depId);
                await prisma.moduleConfig.upsert({
                    where: { id: depId },
                    create: {
                        id: depId,
                        name: depDef?.name ?? depId,
                        enabled: false,
                        config: {},
                    },
                    update: { enabled: false },
                });
            }
        }
    }

    const updated = await prisma.moduleConfig.upsert({
        where: { id: moduleId },
        create: {
            id: moduleId,
            name: definition.name,
            enabled: wantEnabled,
            config: config || {},
        },
        update: {
            enabled: wantEnabled,
            ...(config ? { config } : {}),
        },
    });

    // Invalidate module states cache (Redis + in-memory)
    await invalidateModuleCache();

    // Invalidate translation cache (disabled modules' translations should disappear)
    try {
        const { invalidateTranslationCache } = await import("@/core/lib/i18n/translation-service");
        await invalidateTranslationCache();
    } catch { /* non-fatal */ }

    // Reset hook registry so listeners from the changed module are refreshed
    const { resetHooks, doActionAsync, HookNames } = await import("@/core/lib/hooks");
    resetHooks();
    await doActionAsync(wantEnabled ? HookNames.MODULE_ENABLED : HookNames.MODULE_DISABLED, { moduleId });

    // Execute onEnable/onDisable hooks if defined in manifest
    const hookKey = wantEnabled ? "onEnable" as const : "onDisable" as const;
    const hookRelPath = definition.hooks?.[hookKey];
    let hookError: string | null = null;
    if (hookRelPath) {
        try {
            const modulesRoot = path.resolve(process.cwd(), "src/modules");
            const modulesDir = path.resolve(modulesRoot, moduleId);
            const hookPath = path.resolve(modulesDir, hookRelPath);

            // Belt-and-suspenders: even with the Zod relativePath guard on
            // manifest input, verify the resolved hook path stays inside
            // src/modules/<id>/ before require()-ing it. A compromised module
            // with an absolute or `..`-heavy path must not be able to load
            // arbitrary code from /etc, core/, or another module.
            if (
                !hookPath.startsWith(modulesDir + path.sep) ||
                !modulesDir.startsWith(modulesRoot + path.sep)
            ) {
                hookError = `hook path escapes module directory: ${hookRelPath}`;
                console.error(`[modules] ${moduleId} ${hookKey}: ${hookError}`);
            } else {
                const _require = typeof __webpack_require__ === "function"
                    ? __non_webpack_require__
                    : eval("require");
                const hookModule = _require(hookPath);
                if (typeof hookModule.default === "function") {
                    await hookModule.default();
                }
            }
        } catch (err) {
            hookError = err instanceof Error ? err.message : String(err);
            console.error(`[modules] ${moduleId} ${hookKey} hook failed:`, err);
        }
    }

    if (hookError) {
        // State change is already persisted — we don't revert because
        // that's its own class of problem (partial cleanup) — but the
        // admin gets a clear signal that the hook didn't complete.
        return NextResponse.json({
            ...updated,
            warning: "Module enabled but hook failed",
            hookError: process.env.NODE_ENV === "production" ? undefined : hookError,
        });
    }

    return NextResponse.json(updated);
}

declare const __webpack_require__: unknown;
declare const __non_webpack_require__: (id: string) => Record<string, unknown>;
