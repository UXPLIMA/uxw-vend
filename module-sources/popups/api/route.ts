import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { popupSchema } from "../lib/validations";

export async function GET() {
    const now = new Date();
    const popups = await prisma.popup.findMany({
        where: {
            isActive: true,
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
            AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        orderBy: { createdAt: "desc" },
        take: 1,
    });
    return NextResponse.json({ popups });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const validation = popupSchema.safeParse(body);
    if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }
    const data = validation.data;
    const popup = await prisma.popup.create({
        data: {
            title: data.title,
            content: data.content ?? null,
            image: data.image ?? null,
            link: data.link ?? null,
            linkText: data.linkText ?? null,
            isActive: data.isActive ?? true,
            startsAt: data.startsAt ?? null,
            endsAt: data.endsAt ?? null,
        },
    });
    return NextResponse.json({ popup }, { status: 201 });
}
