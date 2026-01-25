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

    const updated = await prisma.moduleConfig.upsert({
        where: { id: moduleId },
        create: {
            id: moduleId,
            name: definition.name,
            enabled: enabled ?? true,
            config: config || {},
        },
        update: {
            enabled: enabled ?? true,
            ...(config ? { config } : {}),
        },
    });

    return NextResponse.json(updated);
}
