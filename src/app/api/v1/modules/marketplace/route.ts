import { NextResponse } from "next/server";
import { loadMarketplaceCatalog } from "./_catalog";

// GET /api/v1/modules/marketplace - list modules from the local index
export async function GET() {
    try {
        return NextResponse.json(await loadMarketplaceCatalog());
    } catch {
        return NextResponse.json(
            { modules: [], error: "Failed to fetch marketplace" },
            { status: 502 },
        );
    }
}
