import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { z } from "zod";

const popupUpdateSchema = z.object({
    title: z.string().optional(),
    content: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    link: z.string().nullable().optional(),
    linkText: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const validation = popupUpdateSchema.safeParse(body);
    if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }
    const popup = await prisma.popup.update({ where: { id }, data: validation.data });
    return NextResponse.json({ popup });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    await prisma.popup.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
}
