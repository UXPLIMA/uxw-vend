import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The warning system decides when a user gets auto-muted or auto-banned:
 * modules subscribe to "user.warning.threshold" and act on it. The
 * crossing test — `total >= threshold && total - points < threshold` —
 * is what stops the same threshold firing on every subsequent warning,
 * and it had no coverage at all.
 */

const { userWarning, doActionAsync } = vi.hoisted(() => ({
    userWarning: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    doActionAsync: vi.fn(async (_hook: string, _payload: Record<string, unknown>) => { }),
}));

vi.mock("@/core/lib/db", () => ({
    prisma: { userWarning },
    default: { userWarning },
}));

vi.mock("@/core/lib/hooks", () => ({ doActionAsync }));

import {
    getActivePoints,
    issueWarning,
    listWarnings,
    revokeWarning,
} from "@/core/lib/warnings";

/** Hook payloads fired under the given action name. */
function firedAs(action: string): Array<Record<string, unknown>> {
    return doActionAsync.mock.calls
        .filter((c) => c[0] === action)
        .map((c) => c[1] as Record<string, unknown>);
}

beforeEach(() => {
    userWarning.findMany.mockReset().mockResolvedValue([]);
    userWarning.create.mockReset().mockResolvedValue({ id: "w1" });
    userWarning.update.mockReset().mockResolvedValue({});
    doActionAsync.mockClear();
});

describe("getActivePoints", () => {
    it("sums the points of active warnings", async () => {
        userWarning.findMany.mockResolvedValue([{ points: 2 }, { points: 3 }]);
        await expect(getActivePoints("u1")).resolves.toBe(5);
    });

    it("is zero when the user has none", async () => {
        await expect(getActivePoints("u1")).resolves.toBe(0);
    });

    it("counts only non-revoked warnings that have not expired", async () => {
        await getActivePoints("u1");

        const where = userWarning.findMany.mock.calls[0]![0].where;
        expect(where.userId).toBe("u1");
        expect(where.isActive).toBe(true);
        // Either no expiry at all, or one still in the future.
        expect(where.OR[0]).toEqual({ expiresAt: null });
        expect(where.OR[1].expiresAt.gt).toBeInstanceOf(Date);
    });
});

describe("issueWarning", () => {
    it("defaults to a single point and no expiry", async () => {
        await issueWarning({ userId: "u1", issuedById: "mod", reason: "spam" });

        expect(userWarning.create.mock.calls[0]![0].data).toEqual({
            userId: "u1",
            issuedById: "mod",
            reason: "spam",
            points: 1,
            expiresAt: null,
        });
    });

    it("stores an explicit point value and expiry", async () => {
        const expiresAt = new Date("2027-01-01T00:00:00.000Z");
        await issueWarning({
            userId: "u1", issuedById: "mod", reason: "spam", points: 4, expiresAt,
        });

        expect(userWarning.create.mock.calls[0]![0].data).toMatchObject({
            points: 4, expiresAt,
        });
    });

    it("normalises an explicitly null expiry", async () => {
        await issueWarning({
            userId: "u1", issuedById: "mod", reason: "spam", expiresAt: null,
        });
        expect(userWarning.create.mock.calls[0]![0].data.expiresAt).toBeNull();
    });

    it("returns the new id alongside the recomputed total", async () => {
        userWarning.create.mockResolvedValue({ id: "w-42" });
        userWarning.findMany.mockResolvedValue([{ points: 2 }]);

        await expect(issueWarning({ userId: "u1", issuedById: "mod", reason: "r" }))
            .resolves.toEqual({ warningId: "w-42", totalPoints: 2 });
    });

    it("announces the warning with its totals", async () => {
        userWarning.create.mockResolvedValue({ id: "w-42" });
        userWarning.findMany.mockResolvedValue([{ points: 2 }]);

        await issueWarning({ userId: "u1", issuedById: "mod", reason: "spam", points: 2 });

        expect(firedAs("user.warning.issued")[0]).toEqual({
            warningId: "w-42",
            userId: "u1",
            issuedById: "mod",
            reason: "spam",
            points: 2,
            totalPoints: 2,
        });
    });

    it("fires no threshold below three points", async () => {
        userWarning.findMany.mockResolvedValue([{ points: 2 }]);
        await issueWarning({ userId: "u1", issuedById: "mod", reason: "r", points: 2 });

        expect(firedAs("user.warning.threshold")).toHaveLength(0);
    });

    it("fires the threshold on the warning that crosses it", async () => {
        userWarning.findMany.mockResolvedValue([{ points: 3 }]);
        await issueWarning({ userId: "u1", issuedById: "mod", reason: "r", points: 1 });

        expect(firedAs("user.warning.threshold")).toEqual([
            { userId: "u1", points: 3, threshold: 3 },
        ]);
    });

    it("does not re-fire a threshold already crossed", async () => {
        // Was 3, now 4 — the 3-point line was crossed by an earlier warning.
        userWarning.findMany.mockResolvedValue([{ points: 4 }]);
        await issueWarning({ userId: "u1", issuedById: "mod", reason: "r", points: 1 });

        expect(firedAs("user.warning.threshold")).toHaveLength(0);
    });

    it("fires every threshold a single large warning jumps over", async () => {
        userWarning.findMany.mockResolvedValue([{ points: 10 }]);
        await issueWarning({ userId: "u1", issuedById: "mod", reason: "r", points: 10 });

        expect(firedAs("user.warning.threshold").map((p) => p.threshold))
            .toEqual([3, 5, 10]);
    });

    it("fires only the newly crossed thresholds", async () => {
        // From 4 to 6: crosses 5 but not 3 (already crossed) or 10.
        userWarning.findMany.mockResolvedValue([{ points: 6 }]);
        await issueWarning({ userId: "u1", issuedById: "mod", reason: "r", points: 2 });

        expect(firedAs("user.warning.threshold").map((p) => p.threshold)).toEqual([5]);
    });

    it("recomputes the total after the insert, not before", async () => {
        const order: string[] = [];
        userWarning.create.mockImplementation(async () => { order.push("create"); return { id: "w1" }; });
        userWarning.findMany.mockImplementation(async () => { order.push("count"); return []; });

        await issueWarning({ userId: "u1", issuedById: "mod", reason: "r" });

        expect(order).toEqual(["create", "count"]);
    });
});

describe("listWarnings", () => {
    it("returns the user's warnings newest first, with the issuer", async () => {
        userWarning.findMany.mockResolvedValue([{ id: "w1" }]);

        await expect(listWarnings("u1")).resolves.toEqual([{ id: "w1" }]);
        const args = userWarning.findMany.mock.calls[0]![0];
        expect(args.where).toEqual({ userId: "u1" });
        expect(args.orderBy).toEqual({ createdAt: "desc" });
        expect(args.include.issuedBy.select).toEqual({ id: true, username: true });
    });
});

describe("revokeWarning", () => {
    it("deactivates rather than deletes, so the record survives", async () => {
        await revokeWarning("w1");

        expect(userWarning.update).toHaveBeenCalledWith({
            where: { id: "w1" },
            data: { isActive: false },
        });
    });
});
