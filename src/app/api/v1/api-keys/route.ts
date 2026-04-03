import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { randomBytes } from "crypto";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const keys = await prisma.apiKey.findMany({
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ keys: keys.map((k) => ({ ...k, key: k.key.slice(0, 8) + "..." })) });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name, permissions, expiresAt } = await request.json();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const key = `uxw_${randomBytes(24).toString("hex")}`;
    const apiKey = await prisma.apiKey.create({
        data: { name, key, userId: session.user.id, permissions: permissions || [], expiresAt: expiresAt ? new Date(expiresAt) : null },
    });
    return NextResponse.json({ apiKey: { ...apiKey, key } }, { status: 201 });
}
