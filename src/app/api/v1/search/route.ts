import { NextRequest, NextResponse } from "next/server";
import { ModuleSearchProviders } from "@/core/generated/module-search";
import { apiError, withRateLimit } from "@/core/lib/api-utils";
import { SEARCH_QUERY_MAX_LENGTH } from "@/core/lib/constants";
import { applyFiltersAsync } from "@/core/lib/hooks";
import { getModuleStates } from "@/core/lib/module-cache";
import { safeCall } from "@/core/lib/module-safe-call";

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
    icon?: string;
    results: SearchResult[];
}

/**
 * GET /api/v1/search?q=...
 * Public cross-content search.
 *
 * Queries every enabled module's search provider in parallel, groups
 * the results by provider, lets hooks transform the final shape.
 *
 * Anonymous and fan-out: one request reaches every enabled provider, and each
 * one spends a full-text parse or an ILIKE scan on `q`. So the query is
 * bounded before any provider sees it, and the endpoint is rate limited like
 * the rest of the public API - an unbounded `q` at an unbounded rate is a
 * cheap way to hold the database open from the outside.
 *
 * Too long is an error rather than a silent truncation: results for a query
 * the caller did not ask for are a wrong answer dressed as a real one.
 */
export const GET = withRateLimit("search", async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    if (q.length < 2) {
        return NextResponse.json({ groups: [], total: 0 });
    }
    if (q.length > SEARCH_QUERY_MAX_LENGTH) {
        return apiError(
            `Search query must be at most ${SEARCH_QUERY_MAX_LENGTH} characters.`,
            400,
            { code: "query_too_long" },
        );
    }

    const moduleStates = await getModuleStates();
    const enabledProviders = ModuleSearchProviders.filter((p) => moduleStates[p.module] !== false);

    // Wrap each provider's loader + handler in the sandbox: a broken
    // module search provider logs + returns [] instead of crashing the
    // whole /api/v1/search request.
    const groups: ResultGroup[] = await Promise.all(
        enabledProviders.map(async (provider): Promise<ResultGroup> => {
            const results = await safeCall<SearchResult[]>(
                provider.module,
                `search:${provider.id}`,
                async () => {
                    const mod = await provider.loader();
                    const handler = mod.default;
                    const out = (await handler(q)) as SearchResult[];
                    return Array.isArray(out) ? out.slice(0, 10) : [];
                },
                [],
            );
            return { id: provider.id, label: provider.label, icon: provider.icon, results };
        })
    );

    // Filter out empty groups
    const nonEmpty = groups.filter((g) => g.results.length > 0);

    // Allow modules to transform the final result set
    const finalGroups = await applyFiltersAsync("search.groups", nonEmpty, { query: q });

    const total = finalGroups.reduce((sum, g) => sum + g.results.length, 0);

    return NextResponse.json({ groups: finalGroups, total, query: q });
});
