import { describe, it, expect, beforeEach, vi } from "vitest";

const activityFeedItemDeleteMany = vi.fn();
const cronRunDeleteMany = vi.fn();
const revisionDeleteMany = vi.fn();
const userSessionDeleteMany = vi.fn();
const verificationTokenDeleteMany = vi.fn();
const webhookLogDeleteMany = vi.fn();

vi.mock("@/core/lib/db", () => ({
    prisma: {
        activityFeedItem: { deleteMany: (...a: unknown[]) => activityFeedItemDeleteMany(...a) },
        cronRun: { deleteMany: (...a: unknown[]) => cronRunDeleteMany(...a) },
        revision: { deleteMany: (...a: unknown[]) => revisionDeleteMany(...a) },
        userSession: { deleteMany: (...a: unknown[]) => userSessionDeleteMany(...a) },
        verificationToken: { deleteMany: (...a: unknown[]) => verificationTokenDeleteMany(...a) },
        // Present, because the module that owns it is installed. Core still
        // must not touch it.
        webhookLog: { deleteMany: (...a: unknown[]) => webhookLogDeleteMany(...a) },
    },
}));

type RetentionModule = typeof import("@/core/lib/retention");
let mod: RetentionModule;

const DAY_MS = 24 * 60 * 60 * 1000;
const count = (n: number) => ({ count: n });

beforeEach(async () => {
    vi.resetModules();
    for (const fn of [
        activityFeedItemDeleteMany,
        cronRunDeleteMany,
        revisionDeleteMany,
        userSessionDeleteMany,
        verificationTokenDeleteMany,
        webhookLogDeleteMany,
    ]) {
        fn.mockReset().mockResolvedValue(count(0));
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    mod = await import("@/core/lib/retention");
});

describe("retention: pruneOldRecords", () => {
    it("returns a count per table", async () => {
        activityFeedItemDeleteMany.mockResolvedValue(count(5));
        cronRunDeleteMany.mockResolvedValue(count(7));
        revisionDeleteMany.mockResolvedValue(count(3));
        verificationTokenDeleteMany.mockResolvedValue(count(4));

        expect(await mod.pruneOldRecords()).toEqual({
            activityFeed: 5,
            cronRun: 7,
            revision: 3,
            userSession: 0,
            verificationToken: 4,
        });
    });

    it("keeps activity feed items for 180 days", async () => {
        const before = Date.now();
        await mod.pruneOldRecords();
        const arg = activityFeedItemDeleteMany.mock.calls[0]?.[0] as { where: { createdAt: { lt: Date } } };
        expect(arg.where.createdAt.lt).toBeInstanceOf(Date);
        expect(Math.abs(arg.where.createdAt.lt.getTime() - (before - 180 * DAY_MS))).toBeLessThan(200);
    });

    it("keeps cron runs for 30 days and revisions for 365", async () => {
        const before = Date.now();
        await mod.pruneOldRecords();
        const cron = cronRunDeleteMany.mock.calls[0]?.[0] as { where: { lastRunAt: { lt: Date } } };
        const rev = revisionDeleteMany.mock.calls[0]?.[0] as { where: { createdAt: { lt: Date } } };
        expect(Math.abs(cron.where.lastRunAt.lt.getTime() - (before - 30 * DAY_MS))).toBeLessThan(200);
        expect(Math.abs(rev.where.createdAt.lt.getTime() - (before - 365 * DAY_MS))).toBeLessThan(200);
    });

    it("one table failing does not stop the rest", async () => {
        activityFeedItemDeleteMany.mockRejectedValue(new Error("boom"));
        cronRunDeleteMany.mockResolvedValue(count(2));
        revisionDeleteMany.mockResolvedValue(count(4));
        verificationTokenDeleteMany.mockResolvedValue(count(1));

        const result = await mod.pruneOldRecords();
        expect(result.activityFeed).toBe(0);
        expect(result.cronRun).toBe(2);
        expect(result.revision).toBe(4);
        expect(result.verificationToken).toBe(1);
    });
});

/**
 * Email verification and password reset both write a VerificationToken, and
 * both leave the row behind whenever the person never finishes: an unconfirmed
 * signup, a reset link nobody clicked. Nothing consumes an expired one.
 *
 * The prune existed, in `runScheduledTasks()`, which no scheduled job ever
 * called - only `POST /api/v1/admin/cron`, and the admin panel does not use
 * that endpoint. So the rows had accumulated since the table existed.
 */
describe("expired verification tokens", () => {
    it("are pruned by the daily sweep", async () => {
        await mod.pruneOldRecords();
        expect(verificationTokenDeleteMany).toHaveBeenCalledTimes(1);
    });

    it("are pruned on expiry, with no grace window", async () => {
        const before = Date.now();
        await mod.pruneOldRecords();
        const after = Date.now();
        const arg = verificationTokenDeleteMany.mock.calls[0]?.[0] as { where: { expires: { lt: Date } } };
        const cutoff = arg.where.expires.lt.getTime();
        expect(cutoff).toBeGreaterThanOrEqual(before - 200);
        expect(cutoff).toBeLessThanOrEqual(after + 200);
    });

    it("do not take the sweep down when the table is missing", async () => {
        verificationTokenDeleteMany.mockRejectedValue(new Error("relation does not exist"));
        activityFeedItemDeleteMany.mockResolvedValue(count(9));

        const result = await mod.pruneOldRecords();
        expect(result.verificationToken).toBe(0);
        expect(result.activityFeed).toBe(9);
    });
});

/**
 * WebhookLog belongs to the `webhook-logs` module, which runs its own daily
 * cron over that table with the same thirty day window. Core used to prune it
 * as well, behind an `in prisma` guard - a module's work done twice a day, by
 * a core file naming a model it has no business knowing.
 */
describe("a module's table", () => {
    it("is left to the module", async () => {
        await mod.pruneOldRecords();
        expect(webhookLogDeleteMany).not.toHaveBeenCalled();
    });

    it("is not named in core's retention at all", async () => {
        const fs = await import("fs");
        const path = await import("path");
        const source = fs.readFileSync(
            path.join(path.resolve(import.meta.dirname, "../.."), "src/core/lib/retention.ts"),
            "utf8",
        );
        const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        expect(code).not.toContain("webhookLog");
    });
});
