import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

/** GET — list all trophies (public endpoint, used by profile pages too) */
export async function GET() {
    const trophies = await prisma.trophy.findMany({
        orderBy: { points: "desc" },
        include: { _count: { select: { users: true } } },
    });
    return NextResponse.json({ trophies });
}

const trophySchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    icon: z.string().max(50).optional(),
    color: z.string().max(50).optional(),
    points: z.number().int().min(0).default(0),
    awardOn: z.string().max(100).optional(),
});

/** POST — create trophy (admin) */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = trophySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });
    }

    const trophy = await prisma.trophy.create({ data: parsed.data });
    return NextResponse.json({ trophy }, { status: 201 });
}
