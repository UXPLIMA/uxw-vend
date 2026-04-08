import { prisma } from "@/core/lib/db";
import { addAction } from "@/core/lib/hooks";

/**
 * Trophy auto-award engine.
 *
 * Registers hook listeners that count the authoring user's matching
 * ActivityFeedItem rows and award a trophy when a threshold is reached.
 *
 * This file intentionally keeps the ruleset small and hardcoded for now —
 * a later iteration can persist rules on the Trophy model (ruleType /
 * ruleConfig) and make the engine data-driven. The existing
 * `core/lib/trophies.ts` engine already supports DB-defined `awardOn`
 * strings; this engine is ADDITIVE and covers the canonical "out of the
 * box" milestones so a fresh install immediately rewards user engagement.
 *
 * registerTrophyListeners() is idempotent and must be called once at
 * server bootstrap.
 */

interface TrophyRule {
    /** Stable slug used as the Trophy.id so seeding and awarding agree. */
    slug: string;
    /** Hook event name the rule listens to. */
    event: string;
    /** Number of matching events required before the trophy is awarded. */
    threshold: number;
}

export const BUILTIN_TROPHY_RULES: readonly TrophyRule[] = [
    { slug: "first-post",       event: "forum.topic.created",           threshold: 1 },
    { slug: "commenter",        event: "forum.post.created",            threshold: 10 },
    { slug: "voter",            event: "vote.vote.cast",                threshold: 5 },
    { slug: "shopaholic",       event: "store.order.completed",         threshold: 1 },
    { slug: "suggestion-maker", event: "suggestions.suggestion.created", threshold: 1 },
] as const;

let registered = false;

async function qualifies(userId: string, rule: TrophyRule): Promise<boolean> {
    try {
        const count = await prisma.activityFeedItem.count({
            where: { actorId: userId, type: rule.event },
        });
        return count >= rule.threshold;
    } catch {
        return false;
    }
}

async function awardIfQualified(userId: string, rule: TrophyRule): Promise<void> {
    if (!(await qualifies(userId, rule))) return;
    try {
        // Make sure the trophy row exists — the engine should not crash on a
        // fresh install that hasn't run the seed yet.
        const trophy = await prisma.trophy.findUnique({ where: { id: rule.slug } });
        if (!trophy) return;

        await prisma.userTrophy.upsert({
            where: { userId_trophyId: { userId, trophyId: rule.slug } },
            update: {},
            create: { userId, trophyId: rule.slug },
        });
    } catch {
        /* non-fatal — unique violations, DB hiccups */
    }
}

/**
 * Register the hardcoded trophy rules as hook listeners. Idempotent.
 *
 * The engine reads `userId` or `authorId` from each event payload; events
 * that don't expose either are skipped.
 */
export function registerTrophyListeners(): void {
    if (registered) return;
    registered = true;

    // Group rules by event so each hook gets one listener.
    const byEvent = new Map<string, TrophyRule[]>();
    for (const rule of BUILTIN_TROPHY_RULES) {
        const list = byEvent.get(rule.event) || [];
        list.push(rule);
        byEvent.set(rule.event, list);
    }

    for (const [event, rules] of byEvent.entries()) {
        addAction<{ userId?: string; authorId?: string }>(event, async (payload) => {
            const userId = payload.userId || payload.authorId;
            if (!userId) return;
            for (const rule of rules) {
                await awardIfQualified(userId, rule);
            }
        });
    }
}
