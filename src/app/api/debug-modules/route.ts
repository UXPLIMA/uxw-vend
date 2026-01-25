
import { NextResponse } from "next/server";
import { moduleLoader } from "@/core/lib/module-loader";

export async function GET() {
    try {
        const modules = moduleLoader.scanModules();
        const modulesList = Array.from(modules.values());

        return NextResponse.json({
            count: modules.size,
            modules: modulesList.map(m => ({
                id: m.manifest.id,
                name: m.manifest.name,
                path: m.path,
                routes: m.manifest.routes
            }))
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
