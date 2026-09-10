import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/core/lib/activity-log";
import { readJsonBody } from "@/core/lib/api-body";
import { apiError, apiSuccess } from "@/core/lib/api-utils";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { checkNewRestriction, lift } from "@/core/lib/restrictions";
import { restrictionsOn } from "@/core/lib/restrictions-server";

/**
 * Keeping one member out of one part of the site, and letting them back in.
 *
 * The scope is a word core never interprets: `tickets` and `comments` are the
 * names of modules, and core knowing them would be core knowing which modules
 * exist. So nothing here validates it against a list. What is validated is the
 * pair of shapes that would produce a restriction which does not restrict -
 * see `restrictions.ts` for both.
 *
 * Lifting expires the row rather than deleting it. An operator reading
 * somebody's history wants to see the month they spent out of the tickets,
 * and a record that vanishes when the thing it records ends is not a record.
 */
type RouteParams = { params: Promise<{ id: string }> };

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) return { error: apiError("Unauthorized", 401) };
    if (!(await isAdmin(session.user.id))) return { error: apiError("Forbidden", 403) };
    return { session };
}

const placeSchema = z.object({
    scope: z.string().min(1).max(64),
    reason: z.string().max(500).optional().nullable(),
    /** Absent or null is a restriction that never runs out. */
    expiresAt: z.string().datetime().optional().nullable(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;

    const { id } = await params;
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = placeSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Invalid input", 400);

    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
    const refusal = checkNewRestriction(parsed.data.scope, expiresAt);
    if (refusal) {
        return apiError("That restriction would not restrict anything", 400, {
            code: `restriction_${refusal}`,
        });
    }

    const member = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!member) return apiError("Not found", 404);

    const placed = await prisma.userRestriction.create({
        data: {
            userId: id,
            scope: parsed.data.scope.trim(),
            reason: parsed.data.reason?.trim() || null,
            expiresAt,
            issuedById: guard.session?.user?.id ?? null,
        },
    });

    logActivity({
        userId: guard.session?.user?.id,
        action: "user.restriction.place",
        entity: "user",
        entityId: id,
        metadata: { scope: placed.scope, expiresAt: placed.expiresAt?.toISOString() ?? null },
    }).catch(() => {});

    return apiSuccess({ restrictions: await restrictionsOn(id) }, 201);
}

const liftSchema = z.object({ restrictionId: z.string().min(1).max(64) });

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;

    const { id } = await params;
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = liftSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Invalid input", 400);

    // Matched on the member as well as the row, so an id from one member's
    // screen cannot end a restriction on another's.
    const row = await prisma.userRestriction.findFirst({
        where: { id: parsed.data.restrictionId, userId: id },
        select: { id: true, scope: true, expiresAt: true },
    });
    if (!row) return apiError("Not found", 404);

    const now = new Date();
    // Bringing the end forward only. A restriction that already lapsed is not
    // extended to now by lifting it.
    if (row.expiresAt === null || row.expiresAt.getTime() > now.getTime()) {
        await prisma.userRestriction.update({ where: { id: row.id }, data: lift(now) });
    }

    logActivity({
        userId: guard.session?.user?.id,
        action: "user.restriction.lift",
        entity: "user",
        entityId: id,
        metadata: { scope: row.scope },
    }).catch(() => {});

    return apiSuccess({ restrictions: await restrictionsOn(id) });
}

/**
 * The scopes this site has actually used, for the screen to suggest.
 *
 * Read from the rows rather than from a list in code, for the same reason the
 * translation editor reads its module filter from the table: the answer
 * changes with what is installed, and core is not allowed to know their names.
 */
export async function GET() {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;

    const used = await prisma.userRestriction.groupBy({
        by: ["scope"],
        orderBy: { scope: "asc" },
        take: 100,
    });
    return apiSuccess({ scopes: used.map((row) => row.scope) });
}
