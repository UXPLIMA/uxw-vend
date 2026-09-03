import { NextResponse } from "next/server";
import { isSetupComplete } from "@/core/lib/setup-state";
import { loadMarketplaceCatalog } from "@/app/api/v1/modules/marketplace/_catalog";

/**
 * The module catalog offered by the first-run wizard.
 *
 * The wizard used to fetch /api/v1/modules/marketplace directly, which cannot
 * work: the setup gate in proxy.ts answers every path outside /api/setup with
 * 503 "Setup required" until a user exists, so the fetch failed on every
 * install and the module step always rendered "No modules available yet".
 * Nobody could pick a module during setup. The theme step had the same defect
 * and was fixed by adding /api/setup/themes; this is the module counterpart.
 *
 * Gated on setup being incomplete, like every other route under /api/setup -
 * once a site is live, the admin API serves the catalog instead.
 */
export async function GET() {
    if (await isSetupComplete()) {
        return NextResponse.json({ error: "Setup has already been completed." }, { status: 409 });
    }

    try {
        const catalog = await loadMarketplaceCatalog();
        return NextResponse.json({
            modules: catalog.modules.map((m) => ({
                id: m.id,
                name: m.name,
                description: m.description,
                category: m.category,
                tags: m.tags,
                dependencies: m.dependencies,
                conflicts: m.conflicts,
                version: m.version,
                coreVersion: m.coreVersion,
            })),
        });
    } catch {
        // Non-fatal: the step renders its empty state and the operator installs
        // from the marketplace after setup.
        return NextResponse.json({ modules: [], error: "Failed to load the module catalog" }, { status: 502 });
    }
}
