import { prisma } from "@/core/lib/db";
import { doActionAsync } from "@/core/lib/hooks";

/**
 * User warning system.
 *
 * Moderators issue warnings via the admin API. Each warning carries a
 * point value and an optional expiry. Active points are summed across
 * non-expired, isActive warnings to compute the user's current standing.
 *
 * When points cross thresholds, an action hook is fired so other modules
 * (or admins) can react — e.g. auto-mute at 5 points, auto-ban at 10.
 * Listen via:
 *   addAction("user.warning.threshold", ({ userId, points, threshold }) => ...)
 */

export async function getActivePoints(userId: string): Promise<number> {
    const now = new Date();
    const warnings = await prisma.userWarning.findMany({
        where: {
            userId,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { points: true },
    });
    return warnings.reduce((sum, w) => sum + w.points, 0);
}

export async function issueWarning(params: {
    userId: string;
    issuedById: string;
    reason: string;
    points?: number;
    expiresAt?: Date | null;
}): Promise<{ warningId: string; totalPoints: number }> {
    const warning = await prisma.userWarning.create({
        data: {
            userId: params.userId,
            issuedById: params.issuedById,
            reason: params.reason,
            points: params.points ?? 1,
            expiresAt: params.expiresAt || null,
        },
    });

    const totalPoints = await getActivePoints(params.userId);

    await doActionAsync("user.warning.issued", {
        warningId: warning.id,
        userId: params.userId,
        issuedById: params.issuedById,
        reason: params.reason,
        points: params.points ?? 1,
        totalPoints,
    });

    // Fire threshold action when crossing common values
    for (const threshold of [3, 5, 10]) {
        if (totalPoints >= threshold && totalPoints - (params.points ?? 1) < threshold) {
            await doActionAsync("user.warning.threshold", {
                userId: params.userId,
                points: totalPoints,
                threshold,
            });
        }
    }

    return { warningId: warning.id, totalPoints };
}

export async function listWarnings(userId: string) {
    return prisma.userWarning.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { issuedBy: { select: { id: true, username: true } } },
    });
}

export async function revokeWarning(warningId: string): Promise<void> {
    await prisma.userWarning.update({
        where: { id: warningId },
        data: { isActive: false },
    });
}
