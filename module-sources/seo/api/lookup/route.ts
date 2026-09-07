import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/sdk/server";

/**
 * This answer is the same whoever asked, so a proxy in front of the site may
 * hold it briefly. `s-maxage` speaks to shared caches and not to browsers, so
 * no visitor's own cache is involved. Anything here that ever starts varying
 * by who is asking has to lose this.
 */
const SHARED_CACHE = { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" };

export async function GET(request: NextRequest) {
    const path = request.nextUrl.searchParams.get("path");
    if (!path) return NextResponse.json(null, { headers: SHARED_CACHE });
    const page = await prisma.seoPage.findUnique({ where: { path } });
    if (page) return NextResponse.json(page, { headers: { "Cache-Control": "public, s-maxage=60" } });
    const settings = await prisma.setting.findMany({ where: { key: { startsWith: "seo_" } } });
    if (settings.length === 0) return NextResponse.json(null, { headers: SHARED_CACHE });
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value as string; });
    return NextResponse.json({ metaTitle: map.seo_default_title, metaDescription: map.seo_default_description, ogImage: map.seo_default_og_image }, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
