import { NextResponse } from "next/server";
import { themeMarketplaceIndexUrl } from "@/core/lib/marketplace-source";
import { marketplaceFetch } from "@/core/lib/marketplace-fetch";


let cached: Record<string, unknown> | null = null;
let cacheTime = 0;

export async function GET() {
    const now = Date.now();
    if (cached && now - cacheTime < 300000) return NextResponse.json(cached);

    try {
        const res = await marketplaceFetch(themeMarketplaceIndexUrl(), { next: { revalidate: 300 } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        cached = data;
        cacheTime = now;
        return NextResponse.json(data);
    } catch {
        if (cached) return NextResponse.json(cached);
        return NextResponse.json({ themes: [] }, { status: 502 });
    }
}
