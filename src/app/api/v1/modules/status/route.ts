import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

// GET /api/v1/modules/status - Get enabled/disabled status of all modules
export async function GET() {
    try {
        const configs = await prisma.moduleConfig.findMany({
            select: { id: true, enabled: true }
        });
        const modules: Record<string, boolean> = {};
        for (const c of configs) {
            modules[c.id] = c.enabled;
        }
        return NextResponse.json({ modules });
    } catch {
        return NextResponse.json({ modules: {} });
    }
}
