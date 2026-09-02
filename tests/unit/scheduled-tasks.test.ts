import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The core cron hook point. Its one job — expiring verification tokens —
 * is wrapped in a bare catch because the table may not exist on an older
 * schema, and that swallow must not turn into a job that reports success
 * while doing nothing observable.
 */

const { verificationToken } = vi.hoisted(() => ({
    verificationToken: { deleteMany: vi.fn() },
}));

vi.mock("@/core/lib/db", () => ({
    prisma: { verificationToken },
    default: { verificationToken },
}));

import { runScheduledTasks } from "@/core/lib/scheduled-tasks";

beforeEach(() => {
    verificationToken.deleteMany.mockReset().mockResolvedValue({ count: 0 });
});

describe("runScheduledTasks", () => {
    it("deletes only tokens whose expiry has passed", async () => {
        await runScheduledTasks();

        const where = verificationToken.deleteMany.mock.calls[0]![0].where;
        expect(where.expires.lt).toBeInstanceOf(Date);
    });

    it("reports what it cleaned up", async () => {
        verificationToken.deleteMany.mockResolvedValue({ count: 3 });

        await expect(runScheduledTasks()).resolves.toEqual([
            "Cleaned up 3 expired verification token(s)",
        ]);
    });

    it("stays silent when there was nothing to clean", async () => {
        await expect(runScheduledTasks()).resolves.toEqual([]);
    });

    it("does not fail the whole run when the table is missing", async () => {
        verificationToken.deleteMany.mockRejectedValue(new Error("relation does not exist"));

        await expect(runScheduledTasks()).resolves.toEqual([]);
    });
});
