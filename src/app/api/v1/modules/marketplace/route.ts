import { NextResponse } from "next/server";

const MARKETPLACE_URL = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/module-marketplace/index.json";

// Cache marketplace index for 5 minutes
let cachedIndex: any = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// GET /api/v1/modules/marketplace — List available modules from marketplace
export async function GET() {
    const now = Date.now();

    if (cachedIndex && now - cacheTime < CACHE_TTL) {
        return NextResponse.json(cachedIndex);
    }

    try {
        const res = await fetch(MARKETPLACE_URL, { next: { revalidate: 300 } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        cachedIndex = data;
        cacheTime = now;
        return NextResponse.json(data);
    } catch {
        // Return cached if available, otherwise error
        if (cachedIndex) return NextResponse.json(cachedIndex);
        return NextResponse.json({ modules: [], error: "Failed to fetch marketplace" }, { status: 502 });
    }
}
