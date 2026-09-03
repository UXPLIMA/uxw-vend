/**
 * The operator's view: every key, and a way to mint more by hand.
 *
 * A key is never returned in full here - only its hint. An admin who needs to
 * hand somebody a key issues a new one; reading an existing customer's key out
 * of the admin panel is not a thing this module offers.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma, isAdmin, logActivity } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { issueKeys } from "../../../lib/licenses";

async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return { userId: session.user.id };
}

export async function GET(request: NextRequest) {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const search = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const rows = await prisma.licenseKey.findMany({
        where: search
            ? {
                  OR: [
                      { keyHint: { contains: search, mode: "insensitive" } },
                      { productName: { contains: search, mode: "insensitive" } },
                      { note: { contains: search, mode: "insensitive" } },
                  ],
              }
            : undefined,
        orderBy: { createdAt: "desc" },
        take: 500,
        include: { _count: { select: { activations: true } } },
    });

    return NextResponse.json({
        licenses: rows.map((row) => ({
            id: row.id,
            keyHint: row.keyHint,
            productId: row.productId,
            productName: row.productName,
            orderId: row.orderId,
            userId: row.userId,
            status: row.status,
            maxActivations: row.maxActivations,
            activations: row._count.activations,
            expiresAt: row.expiresAt,
            note: row.note,
            createdAt: row.createdAt,
        })),
    });
}

/**
 * Mints keys by hand - a support replacement, a giveaway, a batch for a
 * reseller. The plaintext comes back exactly once, in this response.
 */
export async function POST(request: NextRequest) {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const body = await request.json().catch(() => ({}));
    const count = Math.min(Math.max(Number(body.count) || 1, 1), 500);

    const issued = await issueKeys(count, {
        productId: typeof body.productId === "string" ? body.productId : null,
        productName: typeof body.productName === "string" ? body.productName : null,
        userId: typeof body.userId === "string" ? body.userId : null,
        maxActivations: Number(body.maxActivations) || 1,
        validDays: body.validDays ? Number(body.validDays) : null,
        prefix: typeof body.prefix === "string" ? body.prefix : null,
        note: typeof body.note === "string" ? body.note : null,
    });

    await logActivity({
        userId: guard.userId,
        action: "license.issued",
        entity: "license",
        entityId: issued[0]?.id ?? "",
        metadata: { count, productId: body.productId ?? null },
    }).catch(() => undefined);

    return NextResponse.json({ keys: issued.map((k) => k.key) }, { status: 201 });
}
