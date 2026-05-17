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
