import { NextResponse } from "next/server";

const MARKETPLACE_URL = "https://raw.githubusercontent.com/siracozmen01/uxwVend/main/theme-marketplace/index.json";

let cached: any = null;
let cacheTime = 0;

export async function GET() {
    const now = Date.now();
    if (cached && now - cacheTime < 300000) return NextResponse.json(cached);

    try {
        const res = await fetch(MARKETPLACE_URL, { next: { revalidate: 300 } });
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
