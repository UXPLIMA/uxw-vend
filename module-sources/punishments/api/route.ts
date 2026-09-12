import { NextRequest, NextResponse } from "next/server";
import { pageParams, isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { punishmentCreateSchema } from "../lib/validations";
import { isPunishmentStatus, punishmentStatus, statusWhere } from "../lib/status";
import { canonicalType, spellingsOf } from "../lib/punishment-types";

// GET - Public: list punishments
export async function GET(request: NextRequest) {
    const type = request.nextUrl.searchParams.get("type");
    const search = request.nextUrl.searchParams.get("search");
    const status = request.nextUrl.searchParams.get("status");
    const { page, limit, skip, take } = pageParams(request.nextUrl.searchParams);

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
            skip,
            take,
        }),
        prisma.punishment.count({ where }),
    ]);

    // `status` travels with every row: a caller reading `active` alone cannot
    // tell a ban that is still running from one whose clock ran out.
    const rows = punishments.map((p) => ({ ...p, status: punishmentStatus(p, now.getTime()) }));

    return NextResponse.json({ punishments: rows, total, pages: Math.ceil(total / limit) });
}

/**
 * An administrator issues a punishment on this site.
 *
 * This used to accept an API key as well, so a game server's plugin could
 * post its bans here. That made a module about a member's record the owner of
 * one plugin's payload shape, its spelling of a ban and its idea of who a
 * player is. A module that watches such a server asks `punishment.record`
 * now, and `hooks/record.ts` writes the row; what arrives here is a person
 * with an admin session, and it is filed under the source `site`.
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const issuerUserId: string = session.user.id;

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

    // The member this is against, when the name is one. A punishment issued
    // here is about somebody with an account; one that arrives from a game
    // server may not be, which is why the column is nullable.
    const member = await prisma.user.findFirst({
        where: { username: { equals: playerName, mode: "insensitive" } },
        select: { id: true },
    });

    const punishment = await prisma.punishment.create({
        data: {
            userId: member?.id ?? null,
            source: "site",
            playerName,
            playerUuid: playerUuid || null,
            type: storedType,
            reason: reason || null,
            duration: duration || null,
            punishedBy: punishedBy || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
    });

    const targetUser = member;

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
