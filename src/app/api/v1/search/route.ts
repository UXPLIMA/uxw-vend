import { NextRequest, NextResponse } from "next/server";
import { ModuleSearchProviders } from "@/core/generated/module-search";
import { applyFiltersAsync } from "@/core/lib/hooks";
import { getModuleStates } from "@/core/lib/module-cache";

interface SearchResult {
    type?: string;
    title: string;
    excerpt?: string;
    href: string;
    image?: string;
    score?: number;
}

interface ResultGroup {
    id: string;
    label: string;
    results: SearchResult[];
}

/**
 * GET /api/v1/search?q=...
 * Public cross-content search.
 *
 * Queries every enabled module's search provider in parallel, groups
 * the results by provider, lets hooks transform the final shape.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    if (q.length < 2) {
        return NextResponse.json({ groups: [], total: 0 });
    }

    const moduleStates = await getModuleStates();
    const enabledProviders = ModuleSearchProviders.filter((p) => moduleStates[p.module] !== false);

    const groups: ResultGroup[] = await Promise.all(
        enabledProviders.map(async (provider): Promise<ResultGroup> => {
            try {
                const mod = await provider.loader();
                const handler = mod.default;
                const results = (await handler(q)) as SearchResult[];
                return { id: provider.id, label: provider.label, results: Array.isArray(results) ? results.slice(0, 10) : [] };
            } catch (err) {
                console.error(`[search] ${provider.id} failed:`, err);
                return { id: provider.id, label: provider.label, results: [] };
            }
        })
    );

    // Filter out empty groups
    const nonEmpty = groups.filter((g) => g.results.length > 0);

    // Allow modules to transform the final result set
    const finalGroups = await applyFiltersAsync<ResultGroup[], { query: string }>("search.groups", nonEmpty, { query: q });

    const total = finalGroups.reduce((sum, g) => sum + g.results.length, 0);

    return NextResponse.json({ groups: finalGroups, total, query: q });
}
