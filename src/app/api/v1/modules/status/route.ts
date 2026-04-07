import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/modules/status - Get enabled/disabled status of all modules
export async function GET(request: NextRequest) {
    const internalSecret = process.env.INTERNAL_API_SECRET;
    const headerValue = request.headers.get("x-internal-request");

    const isInternalCall = internalSecret
        ? headerValue === internalSecret
        : headerValue === "1";

    if (!isInternalCall) {
        const session = await auth();
        if (!session?.user?.id || !(await isAdmin(session.user.id))) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

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
