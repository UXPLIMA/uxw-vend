import type { PrismaClient } from "@prisma/client";

/**
 * Seed the 5 built-in trophies. The DB-driven engine in
 * `src/core/lib/trophy-engine.ts` reads the structured rule columns
 * (ruleType / ruleEvent / ruleThreshold) to auto-award them.
 *
 * Idempotent — safe to re-run. Trophy ids are stable slugs so upserts
 * keep existing UserTrophy awards intact across re-seeds.
 */

interface TrophySeed {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    points: number;
    awardOn: string;
    ruleType: string;
    ruleEvent: string;
    ruleThreshold: number;
    isActive: boolean;
}

const TROPHIES: TrophySeed[] = [
    {
        id: "first-post",
        name: "First Post",
        description: "Started your very first forum topic.",
        icon: "MessageSquare",
        color: "#3b82f6",
        points: 5,
        awardOn: "forum.topic.created:1",
        ruleType: "event-count",
        ruleEvent: "forum.topic.created",
        ruleThreshold: 1,
        isActive: true,
    },
    {
        id: "commenter",
        name: "Commenter",
        description: "Replied to 10 forum topics.",
        icon: "MessageSquare",
        color: "#06b6d4",
        points: 15,
        awardOn: "forum.post.created:10",
        ruleType: "event-count",
        ruleEvent: "forum.post.created",
        ruleThreshold: 10,
        isActive: true,
    },
    {
        id: "voter",
        name: "Voter",
        description: "Cast 5 votes for the server.",
        icon: "ThumbsUp",
        color: "#10b981",
        points: 10,
        awardOn: "vote.vote.cast:5",
        ruleType: "event-count",
        ruleEvent: "vote.vote.cast",
        ruleThreshold: 5,
        isActive: true,
    },
    {
        id: "shopaholic",
        name: "Shopaholic",
        description: "Completed your first purchase in the store.",
        icon: "ShoppingBag",
        color: "#f59e0b",
        points: 20,
        awardOn: "store.order.completed:1",
        ruleType: "event-count",
        ruleEvent: "store.order.completed",
        ruleThreshold: 1,
        isActive: true,
    },
    {
        id: "suggestion-maker",
        name: "Suggestion Maker",
        description: "Shared your first suggestion.",
        icon: "Lightbulb",
        color: "#eab308",
        points: 5,
        awardOn: "suggestions.suggestion.created:1",
        ruleType: "event-count",
        ruleEvent: "suggestions.suggestion.created",
        ruleThreshold: 1,
        isActive: true,
    },
];

export async function seedTrophies(prisma: PrismaClient): Promise<void> {
    for (const t of TROPHIES) {
        try {
            await prisma.trophy.upsert({
                where: { id: t.id },
                update: {
                    name: t.name,
                    description: t.description,
                    icon: t.icon,
                    color: t.color,
                    points: t.points,
                    awardOn: t.awardOn,
                    ruleType: t.ruleType,
                    ruleEvent: t.ruleEvent,
                    ruleThreshold: t.ruleThreshold,
                    isActive: t.isActive,
                },
                create: t,
            });
        } catch (err) {
            // Trophy model may not exist in older schemas — log & continue.
            console.warn(`[seed] Failed to seed trophy ${t.id}:`, (err as Error).message);
        }
    }
    console.log(`[ok]Trophies (${TROPHIES.length})`);
}
