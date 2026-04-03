import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET - Public: list punishments
export async function GET(request: NextRequest) {
    const type = request.nextUrl.searchParams.get("type");
    const search = request.nextUrl.searchParams.get("search");
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (search) where.playerName = { contains: search, mode: "insensitive" };

    const [punishments, total] = await Promise.all([
        prisma.punishment.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.punishment.count({ where }),
    ]);

    return NextResponse.json({ punishments, total, pages: Math.ceil(total / limit) });
}

// POST - Admin or external plugin webhook
export async function POST(request: NextRequest) {
    // Check for API key (for external plugin integration) or admin session
    const apiKey = request.headers.get("x-api-key");
    const isPluginAuth = apiKey && apiKey === process.env.PUNISHMENTS_API_KEY;

    if (!isPluginAuth) {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { playerName, playerUuid, type, reason, duration, punishedBy, expiresAt } = await request.json();
    if (!playerName || !type) return NextResponse.json({ error: "playerName and type required" }, { status: 400 });

    const punishment = await prisma.punishment.create({
        data: {
            playerName,
            playerUuid: playerUuid || null,
            type,
            reason: reason || null,
            duration: duration || null,
            punishedBy: punishedBy || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
    });

    return NextResponse.json({ punishment }, { status: 201 });
}
