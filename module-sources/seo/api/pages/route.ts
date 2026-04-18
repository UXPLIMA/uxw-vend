import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { z } from "zod";

export async function GET() {
    try {
        const pages = await prisma.seoPage.findMany({
            orderBy: { path: "asc" },
        });
        return NextResponse.json({ pages });
    } catch {
        return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const body = await request.json();

        const schema = z.object({
            path: z.string().min(1, "Path is required").max(500).refine((v) => v.startsWith("/"), "Path must start with /"),
            metaTitle: z.string().max(200).optional().nullable(),
            metaDescription: z.string().max(1000).optional().nullable(),
            ogTitle: z.string().max(200).optional().nullable(),
            ogDescription: z.string().max(1000).optional().nullable(),
            ogImage: z.string().max(2000).optional().nullable(),
            keywords: z.string().max(500).optional().nullable(),
            canonical: z.string().max(2000).optional().nullable(),
            noIndex: z.boolean().optional(),
            noFollow: z.boolean().optional(),
            structuredData: z.any().optional().nullable(),
        });

        const validation = schema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
        }

        const existing = await prisma.seoPage.findUnique({ where: { path: validation.data.path } });
        if (existing) {
            return NextResponse.json({ error: "A page with this path already exists" }, { status: 409 });
        }

        const page = await prisma.seoPage.create({
            data: {
                path: validation.data.path,
                metaTitle: validation.data.metaTitle || null,
                metaDescription: validation.data.metaDescription || null,
                ogTitle: validation.data.ogTitle || null,
                ogDescription: validation.data.ogDescription || null,
                ogImage: validation.data.ogImage || null,
                keywords: validation.data.keywords || null,
                canonical: validation.data.canonical || null,
                noIndex: validation.data.noIndex ?? false,
                noFollow: validation.data.noFollow ?? false,
                structuredData: validation.data.structuredData || null,
            },
        });

        return NextResponse.json({ page }, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to create page" }, { status: 500 });
    }
}
