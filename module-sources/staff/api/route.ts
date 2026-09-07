import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { staffMemberSchema } from "../lib/validations";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const onlineOnly = searchParams.get("online") === "1";

    const members = await prisma.staffMember.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        include: { user: { select: { id: true, username: true, avatar: true } } },
    });

    if (!onlineOnly) {
        return NextResponse.json({ members });
    }

    // Staff with an unexpired, non-revoked session count as online.
    //
    // Asked of the users rather than of the sessions: a row is written per
    // sign-in and lives until its token expires, so reading every session of
    // every staff member to keep their ids grows with logins. `some` is an
    // existence check the database answers, and the result is one row per
    // staff member however often they signed in.
    const linkedUserIds = members.map((m) => m.user?.id).filter((id): id is string => !!id);
    if (linkedUserIds.length === 0) {
        return NextResponse.json({ members: [] });
    }
    const now = new Date();
    const online = await prisma.user.findMany({
        where: {
            id: { in: linkedUserIds },
            loginSessions: { some: { isRevoked: false, expiresAt: { gt: now } } },
        },
        select: { id: true },
    });
    const onlineUserIds = new Set(online.map((u) => u.id));
    const onlineMembers = members.filter((m) => m.user?.id && onlineUserIds.has(m.user.id));
    return NextResponse.json({ members: onlineMembers });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsed = staffMemberSchema.safeParse(jsonBody);
    if (!parsed.success) {
        return NextResponse.json({ error: "Name and role required" }, { status: 400 });
    }
    const { name, role, avatar, userId, order } = parsed.data;

    const member = await prisma.staffMember.create({
        data: { name, role, avatar: avatar || null, userId: userId || null, order: order || 0 },
    });
    return NextResponse.json({ member }, { status: 201 });
}
