import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

export async function GET(request: NextRequest) {
    const path = request.nextUrl.searchParams.get("path");
    if (!path) return NextResponse.json(null);
    const page = await prisma.seoPage.findUnique({ where: { path } });
    if (page) return NextResponse.json(page, { headers: { "Cache-Control": "public, s-maxage=60" } });
    const settings = await prisma.setting.findMany({ where: { key: { startsWith: "seo_" } } });
    if (settings.length === 0) return NextResponse.json(null);
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value as string; });
    return NextResponse.json({ metaTitle: map.seo_default_title, metaDescription: map.seo_default_description, ogImage: map.seo_default_og_image }, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
