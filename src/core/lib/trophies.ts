import { prisma } from "@/core/lib/db";
import { addAction } from "@/core/lib/hooks";

/**
 * Trophy auto-award system.
 *
 * Admins define trophies in the DB with optional `awardOn` conditions in
 * the format "<hookName>:<threshold>". For example:
 *   awardOn = "blog.article.created:10"
 *   → user gets the trophy after their 10th article
 *
 * registerTrophyListeners() scans all trophies with non-null awardOn,
 * registers a hook listener per (hook, threshold) pair, counts the user's
 * matching ActivityFeedItem entries, and awards the trophy when the
 * threshold is reached.
 *
 * Called from bootstrapHooks() at server startup.
 */

let registered = false;

export async function awardTrophy(userId: string, trophyId: string): Promise<boolean> {
    try {
        await prisma.userTrophy.create({ data: { userId, trophyId } });
        return true;
    } catch {
        return false; // Already has it (unique constraint) or other error
    }
}

export async function registerTrophyListeners(): Promise<void> {
    if (registered) return;
    registered = true;

    let trophies: { id: string; awardOn: string | null }[] = [];
    try {
        trophies = await prisma.trophy.findMany({
            where: { awardOn: { not: null } },
            select: { id: true, awardOn: true },
        });
    } catch {
        return;
    }

    // Group trophies by hook so each hook gets one listener
    const byHook = new Map<string, { id: string; threshold: number }[]>();
    for (const t of trophies) {
        if (!t.awardOn) continue;
        const [hook, thresholdStr] = t.awardOn.split(":");
        const threshold = parseInt(thresholdStr) || 1;
        if (!hook) continue;
        if (!byHook.has(hook)) byHook.set(hook, []);
        byHook.get(hook)!.push({ id: t.id, threshold });
    }

    for (const [hook, hookTrophies] of byHook.entries()) {
        addAction<{ userId?: string; authorId?: string }>(hook, async (payload) => {
            const userId = payload.userId || payload.authorId;
            if (!userId) return;

            // Count this user's matching events from the activity feed
            const count = await prisma.activityFeedItem.count({
                where: { type: hook, actorId: userId },
            });

            for (const t of hookTrophies) {
                if (count >= t.threshold) {
                    await awardTrophy(userId, t.id);
                }
            }
        });
    }
}
