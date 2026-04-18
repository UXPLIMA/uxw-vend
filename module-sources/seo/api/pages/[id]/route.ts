import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { id } = await params;
        const body = await request.json();

        const schema = z.object({
            path: z.string().min(1).max(500).refine((v) => v.startsWith("/"), "Path must start with /").optional(),
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

        if (validation.data.path) {
            const existing = await prisma.seoPage.findFirst({
                where: { path: validation.data.path, id: { not: id } },
            });
            if (existing) {
                return NextResponse.json({ error: "A page with this path already exists" }, { status: 409 });
            }
        }

        const page = await prisma.seoPage.update({
            where: { id },
            data: {
                ...(validation.data.path !== undefined && { path: validation.data.path }),
                ...(validation.data.metaTitle !== undefined && { metaTitle: validation.data.metaTitle || null }),
                ...(validation.data.metaDescription !== undefined && { metaDescription: validation.data.metaDescription || null }),
                ...(validation.data.ogTitle !== undefined && { ogTitle: validation.data.ogTitle || null }),
                ...(validation.data.ogDescription !== undefined && { ogDescription: validation.data.ogDescription || null }),
                ...(validation.data.ogImage !== undefined && { ogImage: validation.data.ogImage || null }),
                ...(validation.data.keywords !== undefined && { keywords: validation.data.keywords || null }),
                ...(validation.data.canonical !== undefined && { canonical: validation.data.canonical || null }),
                ...(validation.data.noIndex !== undefined && { noIndex: validation.data.noIndex }),
                ...(validation.data.noFollow !== undefined && { noFollow: validation.data.noFollow }),
                ...(validation.data.structuredData !== undefined && { structuredData: validation.data.structuredData || null }),
            },
        });

        return NextResponse.json({ page });
    } catch {
        return NextResponse.json({ error: "Failed to update page" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { id } = await params;
        await prisma.seoPage.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
    }
}
