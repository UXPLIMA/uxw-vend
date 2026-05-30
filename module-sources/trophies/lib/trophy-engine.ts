import { prisma } from "@/core/lib/db";
import { addAction } from "@/core/lib/hooks";

/**
 * Trophy auto-award engine (DB-driven).
 *
 * Admins define trophies in the database with:
 *   - ruleType = "event-count"
 *   - ruleEvent = "<hook.event.name>"
 *   - ruleThreshold = <number>
 *   - isActive = true
 *
 * `registerTrophyListeners()` scans every active trophy with a non-null
 * `ruleEvent`, groups them by event, and installs a single hook listener
 * per event. Each listener counts the user's matching ActivityFeedItem
 * rows (type === ruleEvent, actorId === userId) and awards any trophy
 * whose threshold is met. Upserts are idempotent.
 *
 * If the DB query fails at bootstrap (e.g. migrations not yet applied,
 * transient DB hiccup) the engine returns an empty ruleset — core knows
 * nothing about which modules' events should award trophies. Admins seed
 * their own trophy rules through the admin UI.
 *
 * The module-scope `registered` flag keeps bootstrap idempotent across
 * duplicate layout renders in dev. Pass `force = true` from the admin
 * "reload" endpoint to re-wire after rule edits.
 */

interface TrophyRule {
    /** Trophy row id (used for the userTrophy upsert). */
    trophyId: string;
    /** Hook event name this rule listens to. */
    event: string;
    /** Minimum matching event count required to award. */
    threshold: number;
}

/**
 * The five starter trophies this module ships with. They are seeded ONCE,
 * on the first boot after the module is installed (see `seedDefaultTrophies`),
 * so an admin can edit or delete them freely afterwards without them coming
 * back. Rules reference other modules' events (forum, vote, store,
 * suggestions); if those modules are not installed the rule simply never
 * fires — the module is fully self-contained and core stays module-agnostic.
 */
const DEFAULT_TROPHIES = [
    { id: "first-post", name: "First Post", description: "Started your very first forum topic.", icon: "MessageSquare", color: "#3b82f6", points: 5, awardOn: "forum.topic.created:1", ruleType: "event-count", ruleEvent: "forum.topic.created", ruleThreshold: 1, isActive: true },
    { id: "commenter", name: "Commenter", description: "Replied to 10 forum topics.", icon: "MessageSquare", color: "#06b6d4", points: 15, awardOn: "forum.post.created:10", ruleType: "event-count", ruleEvent: "forum.post.created", ruleThreshold: 10, isActive: true },
    { id: "voter", name: "Voter", description: "Cast 5 votes for the server.", icon: "ThumbsUp", color: "#10b981", points: 10, awardOn: "vote.vote.cast:5", ruleType: "event-count", ruleEvent: "vote.vote.cast", ruleThreshold: 5, isActive: true },
    { id: "shopaholic", name: "Shopaholic", description: "Completed your first purchase in the store.", icon: "ShoppingBag", color: "#f59e0b", points: 20, awardOn: "store.order.completed:1", ruleType: "event-count", ruleEvent: "store.order.completed", ruleThreshold: 1, isActive: true },
    { id: "suggestion-maker", name: "Suggestion Maker", description: "Shared your first suggestion.", icon: "Lightbulb", color: "#eab308", points: 5, awardOn: "suggestions.suggestion.created:1", ruleType: "event-count", ruleEvent: "suggestions.suggestion.created", ruleThreshold: 1, isActive: true },
];

/**
 * Seed the starter trophies, but ONLY when the table is empty — i.e. the very
 * first boot after install. Once any trophy exists (including admin-created
 * ones) this is a no-op, so deleting a default trophy makes it stay deleted.
 * Idempotent and non-fatal: a DB hiccup just skips the seed for this boot.
 *
 * This lives in the module (not core) so core ships zero knowledge of any
 * module's default data — installing the module is what creates them.
 */
export async function seedDefaultTrophies(): Promise<void> {
    try {
        const existing = await prisma.trophy.count();
        if (existing > 0) return;
        await prisma.trophy.createMany({ data: DEFAULT_TROPHIES, skipDuplicates: true });
        console.log(`[trophies] Seeded ${DEFAULT_TROPHIES.length} default trophies`);
    } catch (err) {
        console.warn("[trophies] default seed skipped:", (err as Error).message);
    }
}

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
        // Ensure trophy row exists — do not crash if it was deleted mid-flight.
        const trophy = await prisma.trophy.findUnique({
            where: { id: rule.trophyId },
            select: { id: true, isActive: true },
        });
        if (!trophy || trophy.isActive === false) return;

        await prisma.userTrophy.upsert({
            where: { userId_trophyId: { userId, trophyId: rule.trophyId } },
            update: {},
            create: { userId, trophyId: rule.trophyId },
        });
    } catch {
        /* non-fatal: unique violations, DB hiccups */
    }
}

/**
 * Load the current active ruleset from the DB. Returns an empty list and
 * logs a warning if the query fails — core does not ship any module-aware
 * fallback rules.
 */
async function loadRules(): Promise<TrophyRule[]> {
    try {
        const rows = await prisma.trophy.findMany({
            where: { isActive: true, ruleEvent: { not: null } },
            select: { id: true, ruleEvent: true, ruleThreshold: true, ruleType: true },
        });
        const rules: TrophyRule[] = [];
        for (const r of rows) {
            if (!r.ruleEvent) continue;
            // Only event-count is implemented today; other types no-op
            // gracefully so the admin can stage them ahead of engine support.
            if (r.ruleType && r.ruleType !== "event-count") continue;
            rules.push({
                trophyId: r.id,
                event: r.ruleEvent,
                threshold: r.ruleThreshold ?? 1,
            });
        }
        return rules;
    } catch (err) {
        console.warn("[trophy-engine] DB rule load failed; no trophy rules will be wired this boot:", (err as Error).message);
        return [];
    }
}

/**
 * Register hook listeners for every active trophy rule. Idempotent.
 *
 * @param force - re-register even if already bootstrapped (used after
 *                admin rule edits via the reload endpoint). Note: core
 *                hooks.ts does not support removing listeners, so forced
 *                reloads add new listeners on top of existing ones. New
 *                listeners always run `awardIfQualified` which is
 *                idempotent, so duplicate wiring is harmless.
 */
export async function registerTrophyListeners(force = false): Promise<void> {
    if (registered && !force) return;
    registered = true;

    const rules = await loadRules();
    if (rules.length === 0) return;

    // Group rules by event so each hook gets exactly one listener.
    const byEvent = new Map<string, TrophyRule[]>();
    for (const rule of rules) {
        const list = byEvent.get(rule.event) || [];
        list.push(rule);
        byEvent.set(rule.event, list);
    }

    for (const [event, eventRules] of byEvent.entries()) {
        addAction<{ userId?: string; authorId?: string }>(event, async (payload) => {
            const userId = payload.userId || payload.authorId;
            if (!userId) return;
            for (const rule of eventRules) {
                await awardIfQualified(userId, rule);
            }
        });
    }
}
