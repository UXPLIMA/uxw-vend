import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { punishmentCreateSchema } from "../lib/validations";
import { isPunishmentStatus, punishmentStatus, statusWhere } from "../lib/status";
import { canonicalType, spellingsOf } from "../lib/punishment-types";

/**
 * Constant-time API key comparison. Guards against undefined values and
 * length mismatches before timingSafeEqual (which throws on unequal-length
 * buffers) so an attacker can't learn the key length via a timing or error
 * signal.
 */
function apiKeyMatches(provided: string | null | undefined, expected: string | undefined): boolean {
    if (!provided || !expected) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

// GET - Public: list punishments
export async function GET(request: NextRequest) {
    const type = request.nextUrl.searchParams.get("type");
    const search = request.nextUrl.searchParams.get("search");
    const status = request.nextUrl.searchParams.get("status");
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "20") || 20));

    const now = new Date();
    const where: Record<string, unknown> = {};
    // A type filter is a filter on the punishment, not on the spelling the
    // row happened to be written with.
    if (type) {
        const canonical = canonicalType(type);
        where.type = canonical ? { in: spellingsOf(canonical) } : type;
    }
    if (search) where.playerName = { contains: search, mode: "insensitive" };
    // Under AND rather than merged in, so the status clause keeps its own `OR`
    // whatever else the caller filtered on.
    if (isPunishmentStatus(status)) where.AND = [statusWhere(status, now)];

    const [punishments, total] = await Promise.all([
        prisma.punishment.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.punishment.count({ where }),
    ]);

    // `status` travels with every row: a caller reading `active` alone cannot
    // tell a ban that is still running from one whose clock ran out.
    const rows = punishments.map((p) => ({ ...p, status: punishmentStatus(p, now.getTime()) }));

    return NextResponse.json({ punishments: rows, total, pages: Math.ceil(total / limit) });
}

// POST - Admin or external plugin webhook
export async function POST(request: NextRequest) {
    // Check for API key (for external plugin integration) or admin session
    const apiKey = request.headers.get("x-api-key");
    const isPluginAuth = apiKeyMatches(apiKey, process.env.PUNISHMENTS_API_KEY);

    let issuerUserId: string | null = null;
    if (!isPluginAuth) {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        issuerUserId = session.user.id;
    }

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsed = punishmentCreateSchema.safeParse(jsonBody);
    if (!parsed.success) {
        return NextResponse.json({ error: "playerName and type required" }, { status: 400 });
    }
    const { playerName, playerUuid, type, reason, duration, punishedBy, expiresAt } = parsed.data;
    // Stored in this module's own words when it recognises them, so the
    // filters and the labels have one thing to match.
    const storedType = canonicalType(type) ?? type;

    const punishment = await prisma.punishment.create({
        data: {
            playerName,
            playerUuid: playerUuid || null,
            type: storedType,
            reason: reason || null,
            duration: duration || null,
            punishedBy: punishedBy || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
    });

    // Try to find a matching site user by username for warning/feed linkage
    const targetUser = await prisma.user.findFirst({
        where: { username: playerName },
        select: { id: true },
    }).catch(() => null);

    // For warning-type punishments, also record a UserWarning row
    if (storedType === "warning") {
        if (targetUser) {
            await prisma.userWarning.create({
                data: {
                    userId: targetUser.id,
                    issuedById: issuerUserId,
                    reason: reason || "No reason provided",
                    expiresAt: expiresAt ? new Date(expiresAt) : null,
                },
            }).catch(() => {});
        }
    }

    // Fire hook + activity feed entry (private)
    const { doActionAsync } = await import("@/core/sdk");
    await doActionAsync("punishments.punishment.issued", {
        punishmentId: punishment.id,
        playerName,
        type: storedType,
        reason,
        issuerUserId,
        targetUserId: targetUser?.id ?? null,
    });
    if (targetUser) {
        await prisma.activityFeedItem.create({
            data: {
                type: "punishments.punishment.issued",
                actorId: issuerUserId,
                title: `${storedType} issued to ${playerName}${reason ? `: ${reason}` : ""}`,
                icon: "AlertTriangle",
                isPublic: false,
            },
        }).catch(() => {});
    }

    return NextResponse.json({ punishment }, { status: 201 });
}
