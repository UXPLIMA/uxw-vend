import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import moduleSystem from "@/core/lib/modules";

// GET /api/v1/modules - Get all modules with their status
export async function GET() {
    const definitions = moduleSystem.getDefinitions();
    const configs = await prisma.moduleConfig.findMany();

    const configMap = new Map(configs.map(c => [c.id, c]));

    const modules = definitions.map(def => ({
        ...def,
        enabled: configMap.get(def.id)?.enabled ?? true,
        config: {
            ...def.defaultConfig,
            ...(configMap.get(def.id)?.config as object || {}),
        },
    }));

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

    // --- Dependency resolution ---
    if (wantEnabled) {
        // When enabling: check that all dependencies are enabled
        const deps = definition.dependencies ?? [];
        if (deps.length > 0) {
            const configs = await prisma.moduleConfig.findMany();
            const configMap = new Map(configs.map(c => [c.id, c]));
            const missingDeps: string[] = [];

            for (const dep of deps) {
                const depDef = moduleSystem.getDefinition(dep);
                if (!depDef) {
                    missingDeps.push(dep);
                    continue;
                }
                const depConfig = configMap.get(dep);
                // Default is enabled if no DB record exists
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
            const configs = await prisma.moduleConfig.findMany();
            const activeConflicts = conflicts.filter(cId => {
                const c = configs.find(cfg => cfg.id === cId);
                return c?.enabled === true;
            });
            if (activeConflicts.length > 0) {
                const conflictNames = activeConflicts.map(cId => moduleSystem.getDefinition(cId)?.name || cId);
                return NextResponse.json({
                    error: `Cannot enable '${definition.name}': incompatible with ${conflictNames.join(', ')}`,
                    conflicts: activeConflicts,
                }, { status: 400 });
            }
        }

        // Also check if any enabled module declares conflict with this one
        const allDefs = moduleSystem.getDefinitions();
        const configs2 = await prisma.moduleConfig.findMany();
        for (const def of allDefs) {
            if (def.id === moduleId) continue;
            const theirConflicts = def.conflicts ?? [];
            if (theirConflicts.includes(moduleId)) {
                const isEnabled = configs2.find(c => c.id === def.id)?.enabled === true;
                if (isEnabled) {
                    return NextResponse.json({
                        error: `Cannot enable '${definition.name}': incompatible with ${def.name}`,
                        conflicts: [def.id],
                    }, { status: 400 });
                }
            }
        }
    } else {
        // When disabling: check if any enabled module depends on this one
        const allDefs = moduleSystem.getDefinitions();
        const configs = await prisma.moduleConfig.findMany();
        const configMap = new Map(configs.map(c => [c.id, c]));
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

    return NextResponse.json(updated);
}
