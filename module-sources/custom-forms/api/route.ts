import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { generateSlug } from "@/core/lib/utils";

export async function GET() {
    const forms = await prisma.customForm.findMany({
        where: { isActive: true },
        select: { id: true, title: true, slug: true, description: true },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ forms });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { title, description, fields } = await request.json();
    if (!title || !fields) return NextResponse.json({ error: "Title and fields required" }, { status: 400 });

    const slug = generateSlug(title);
    const form = await prisma.customForm.create({
        data: { title, slug, description: description || null, fields },
    });

    // Fire hook for cross-module reactions
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("customforms.form.created", form);

    return NextResponse.json({ form }, { status: 201 });
}
