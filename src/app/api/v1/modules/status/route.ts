import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

// GET /api/v1/modules/status - Get enabled/disabled status of all modules
export async function GET() {
    try {
        const moduleConfigs = await prisma.moduleConfig.findMany();

        const modules: Record<string, boolean> = {};
        for (const config of moduleConfigs) {
            modules[config.id] = config.enabled;
        }

        // Default all modules to enabled if not in database
        const defaultModules = ['store', 'forum', 'blog', 'tickets', 'help-center'];
        for (const moduleId of defaultModules) {
            if (!(moduleId in modules)) {
                modules[moduleId] = true;
            }
        }

        return NextResponse.json({ modules });
    } catch (error) {
        // On error, return all enabled
        return NextResponse.json({
            modules: {
                store: true,
                forum: true,
                blog: true,
                tickets: true,
                'help-center': true,
            }
        });
    }
}
