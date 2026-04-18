import { describe, it, expect, beforeEach, vi } from "vitest";

// Deletemany mocks — one per table
const activityFeedItemDeleteMany = vi.fn();
const webhookLogDeleteMany = vi.fn();
const cronRunDeleteMany = vi.fn();
const revisionDeleteMany = vi.fn();
const userSessionDeleteMany = vi.fn();

// Toggle whether webhookLog key exists on prisma mock
let includeWebhookLog = true;

vi.mock("@/core/lib/db", () => {
    // Use a getter so each test can toggle includeWebhookLog before importing
    const prismaBase: Record<string, unknown> = {
        activityFeedItem: {
            deleteMany: (...args: unknown[]) => activityFeedItemDeleteMany(...args),
        },
        cronRun: {
            deleteMany: (...args: unknown[]) => cronRunDeleteMany(...args),
        },
        revision: {
            deleteMany: (...args: unknown[]) => revisionDeleteMany(...args),
        },
        userSession: {
            deleteMany: (...args: unknown[]) => userSessionDeleteMany(...args),
        },
    };
    return {
        get prisma() {
            if (includeWebhookLog) {
                return {
                    ...prismaBase,
                    webhookLog: {
                        deleteMany: (...args: unknown[]) => webhookLogDeleteMany(...args),
                    },
                };
            }
            return prismaBase;
        },
    };
});

type RetentionModule = typeof import("@/core/lib/retention");
let mod: RetentionModule;

beforeEach(async () => {
    vi.resetModules();
    activityFeedItemDeleteMany.mockReset();
    webhookLogDeleteMany.mockReset();
    cronRunDeleteMany.mockReset();
    revisionDeleteMany.mockReset();
    userSessionDeleteMany.mockReset();
    userSessionDeleteMany.mockResolvedValue({ count: 0 });
    includeWebhookLog = true;
    // Silence expected error logs
    vi.spyOn(console, "error").mockImplementation(() => {});

    mod = await import("@/core/lib/retention");
});

function countResult(n: number) {
    return { count: n };
}

describe("retention: pruneOldRecords", () => {
    it("returns aggregate counts from each table", async () => {
        activityFeedItemDeleteMany.mockResolvedValue(countResult(5));
        webhookLogDeleteMany.mockResolvedValue(countResult(2));
        cronRunDeleteMany.mockResolvedValue(countResult(7));
        revisionDeleteMany.mockResolvedValue(countResult(3));

        const result = await mod.pruneOldRecords();
        expect(result).toEqual({
            activityFeed: 5,
            webhookLog: 2,
            cronRun: 7,
            revision: 3,
            userSession: 0,
        });
    });

    it("calls deleteMany with a createdAt.lt cutoff for activityFeedItem (180 days)", async () => {
        activityFeedItemDeleteMany.mockResolvedValue(countResult(0));
        webhookLogDeleteMany.mockResolvedValue(countResult(0));
        cronRunDeleteMany.mockResolvedValue(countResult(0));
        revisionDeleteMany.mockResolvedValue(countResult(0));

        const before = Date.now();
        await mod.pruneOldRecords();
        const after = Date.now();

        const arg = activityFeedItemDeleteMany.mock.calls[0]?.[0] as {
            where: { createdAt: { lt: Date } };
        };
        expect(arg.where.createdAt.lt).toBeInstanceOf(Date);
        const cutoffMs = arg.where.createdAt.lt.getTime();
        const expected180 = before - 180 * 24 * 60 * 60 * 1000;
        expect(cutoffMs).toBeGreaterThanOrEqual(expected180 - 10);
        expect(cutoffMs).toBeLessThanOrEqual(after - 180 * 24 * 60 * 60 * 1000 + 10);
    });

    it("uses a 30-day cutoff for webhookLog and cronRun", async () => {
        activityFeedItemDeleteMany.mockResolvedValue(countResult(0));
        webhookLogDeleteMany.mockResolvedValue(countResult(0));
        cronRunDeleteMany.mockResolvedValue(countResult(0));
        revisionDeleteMany.mockResolvedValue(countResult(0));

        const before = Date.now();
        await mod.pruneOldRecords();

        const whArg = webhookLogDeleteMany.mock.calls[0]?.[0] as {
            where: { createdAt: { lt: Date } };
        };
        const crArg = cronRunDeleteMany.mock.calls[0]?.[0] as {
            where: { lastRunAt: { lt: Date } };
        };
        const dayMs = 24 * 60 * 60 * 1000;
        expect(Math.abs(whArg.where.createdAt.lt.getTime() - (before - 30 * dayMs))).toBeLessThan(100);
        expect(Math.abs(crArg.where.lastRunAt.lt.getTime() - (before - 30 * dayMs))).toBeLessThan(100);
    });

    it("uses a 365-day cutoff for revision", async () => {
        activityFeedItemDeleteMany.mockResolvedValue(countResult(0));
        webhookLogDeleteMany.mockResolvedValue(countResult(0));
        cronRunDeleteMany.mockResolvedValue(countResult(0));
        revisionDeleteMany.mockResolvedValue(countResult(0));

        const before = Date.now();
        await mod.pruneOldRecords();

        const revArg = revisionDeleteMany.mock.calls[0]?.[0] as {
            where: { createdAt: { lt: Date } };
        };
        const dayMs = 24 * 60 * 60 * 1000;
        expect(Math.abs(revArg.where.createdAt.lt.getTime() - (before - 365 * dayMs))).toBeLessThan(100);
    });

    it("one table failure does not block the others", async () => {
        activityFeedItemDeleteMany.mockRejectedValue(new Error("boom"));
        webhookLogDeleteMany.mockResolvedValue(countResult(1));
        cronRunDeleteMany.mockResolvedValue(countResult(2));
        revisionDeleteMany.mockResolvedValue(countResult(4));

        const result = await mod.pruneOldRecords();
        expect(result.activityFeed).toBe(0);
        expect(result.webhookLog).toBe(1);
        expect(result.cronRun).toBe(2);
        expect(result.revision).toBe(4);
    });

    it("cronRun failure does not block revision", async () => {
        activityFeedItemDeleteMany.mockResolvedValue(countResult(5));
        webhookLogDeleteMany.mockResolvedValue(countResult(1));
        cronRunDeleteMany.mockRejectedValue(new Error("db err"));
        revisionDeleteMany.mockResolvedValue(countResult(8));

        const result = await mod.pruneOldRecords();
        expect(result.cronRun).toBe(0);
        expect(result.revision).toBe(8);
    });

    it("gracefully skips webhookLog when prisma.webhookLog is undefined", async () => {
        includeWebhookLog = false;
        vi.resetModules();
        mod = await import("@/core/lib/retention");

        activityFeedItemDeleteMany.mockResolvedValue(countResult(3));
        cronRunDeleteMany.mockResolvedValue(countResult(2));
        revisionDeleteMany.mockResolvedValue(countResult(1));

        const result = await mod.pruneOldRecords();
        expect(result.webhookLog).toBe(0);
        expect(webhookLogDeleteMany).not.toHaveBeenCalled();
        expect(result.activityFeed).toBe(3);
        expect(result.cronRun).toBe(2);
        expect(result.revision).toBe(1);
    });
});
