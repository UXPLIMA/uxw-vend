import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A broadcast fans one message out to every user on the instance. The two
 * things worth pinning are the recipient filter — sending a role-targeted
 * mail to everyone cannot be recalled — and the terminal status, since a
 * run that leaves a row in "sending" forever blocks the cron from ever
 * picking up the next broadcast.
 */

const { emailBroadcast, user, sendEmail, log } = vi.hoisted(() => ({
    emailBroadcast: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn() },
    sendEmail: vi.fn(async (_opts: { to: string; subject: string; html: string }) => true),
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/core/lib/db", () => ({
    prisma: { emailBroadcast, user },
    default: { emailBroadcast, user },
}));
vi.mock("@/core/lib/email", () => ({ sendEmail }));
vi.mock("@/core/lib/logger", () => ({ log }));

import { queueBroadcast, processQueuedBroadcasts } from "@/core/lib/broadcasts";

function people(count: number, over: Partial<{ email: string }> = {}) {
    return Array.from({ length: count }, (_, i) => ({
        id: `u${i}`,
        email: over.email ?? `u${i}@example.com`,
        username: `user${i}`,
    }));
}

function broadcastRow(over: Record<string, unknown> = {}) {
    return {
        id: "b1",
        subject: "Maintenance window",
        body: "Hi {username}, we are going down at 02:00.",
        filter: { all: true },
        ...over,
    };
}

/** The `data` of the final update, which carries the terminal status. */
function finalUpdate(): Record<string, unknown> {
    const calls = emailBroadcast.update.mock.calls;
    return calls.at(-1)![0].data;
}

beforeEach(() => {
    emailBroadcast.findUnique.mockReset().mockResolvedValue(null);
    emailBroadcast.findFirst.mockReset().mockResolvedValue(null);
    emailBroadcast.update.mockReset().mockResolvedValue({});
    user.findMany.mockReset().mockResolvedValue([]);
    sendEmail.mockReset().mockResolvedValue(true);
    log.info.mockReset();
});

// ===========================================================================

describe("queueBroadcast", () => {
    it("refuses an unknown broadcast", async () => {
        await expect(queueBroadcast("nope")).rejects.toThrow("Broadcast not found");
    });

    it("marks the row queued with its recipient count", async () => {
        emailBroadcast.findUnique.mockResolvedValue(broadcastRow());
        user.findMany.mockResolvedValue(people(3));

        await expect(queueBroadcast("b1")).resolves.toEqual({ totalCount: 3 });
        expect(emailBroadcast.update).toHaveBeenCalledWith({
            where: { id: "b1" },
            data: { status: "queued", totalCount: 3 },
        });
    });
});

describe("recipient filtering", () => {
    beforeEach(() => {
        emailBroadcast.findUnique.mockResolvedValue(broadcastRow());
    });

    it("never includes banned users", async () => {
        await queueBroadcast("b1");
        expect(user.findMany.mock.calls[0]![0].where.isBanned).toBe(false);
    });

    it("targets everyone when the filter says all", async () => {
        await queueBroadcast("b1");

        const where = user.findMany.mock.calls[0]![0].where;
        expect(where).not.toHaveProperty("id");
        expect(where).not.toHaveProperty("roleId");
    });

    it("targets the named users", async () => {
        emailBroadcast.findUnique.mockResolvedValue(
            broadcastRow({ filter: { userIds: ["u1", "u2"] } }),
        );

        await queueBroadcast("b1");

        expect(user.findMany.mock.calls[0]![0].where.id).toEqual({ in: ["u1", "u2"] });
    });

    it("targets the named roles", async () => {
        emailBroadcast.findUnique.mockResolvedValue(
            broadcastRow({ filter: { roleIds: ["r1"] } }),
        );

        await queueBroadcast("b1");

        expect(user.findMany.mock.calls[0]![0].where.roleId).toEqual({ in: ["r1"] });
    });

    it("lets an explicit user list win over a role list", async () => {
        emailBroadcast.findUnique.mockResolvedValue(
            broadcastRow({ filter: { userIds: ["u1"], roleIds: ["r1"] } }),
        );

        await queueBroadcast("b1");

        const where = user.findMany.mock.calls[0]![0].where;
        expect(where.id).toEqual({ in: ["u1"] });
        expect(where).not.toHaveProperty("roleId");
    });

    it("ignores an empty id list rather than targeting nobody", async () => {
        emailBroadcast.findUnique.mockResolvedValue(
            broadcastRow({ filter: { userIds: [], roleIds: ["r1"] } }),
        );

        await queueBroadcast("b1");

        expect(user.findMany.mock.calls[0]![0].where.roleId).toEqual({ in: ["r1"] });
    });

    it("skips users with no email address", async () => {
        user.findMany.mockResolvedValue([
            { id: "u1", email: "a@b.co", username: "a" },
            { id: "u2", email: null, username: "b" },
            { id: "u3", email: "", username: "c" },
        ]);

        await expect(queueBroadcast("b1")).resolves.toEqual({ totalCount: 1 });
    });
});

describe("processQueuedBroadcasts", () => {
    it("does nothing when the queue is empty", async () => {
        await processQueuedBroadcasts();
        expect(emailBroadcast.update).not.toHaveBeenCalled();
    });

    it("takes the oldest queued broadcast", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());

        await processQueuedBroadcasts();

        expect(emailBroadcast.findFirst).toHaveBeenCalledWith({
            where: { status: "queued" },
            orderBy: { createdAt: "asc" },
        });
    });

    it("claims the row as sending before it starts", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());

        await processQueuedBroadcasts();

        const first = emailBroadcast.update.mock.calls[0]![0].data;
        expect(first.status).toBe("sending");
        expect(first.startedAt).toBeInstanceOf(Date);
    });

    it("sends one message per recipient", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        user.findMany.mockResolvedValue(people(3));

        await processQueuedBroadcasts();

        expect(sendEmail).toHaveBeenCalledTimes(3);
    });

    it("substitutes the recipient's username into the body", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        user.findMany.mockResolvedValue(people(1));

        await processQueuedBroadcasts();

        expect(sendEmail.mock.calls[0]![0]).toEqual({
            to: "u0@example.com",
            subject: "Maintenance window",
            html: "Hi user0, we are going down at 02:00.",
        });
    });

    it("replaces every occurrence of the placeholder", async () => {
        emailBroadcast.findFirst.mockResolvedValue(
            broadcastRow({ body: "{username} {username}" }),
        );
        user.findMany.mockResolvedValue(people(1));

        await processQueuedBroadcasts();

        expect(sendEmail.mock.calls[0]![0].html).toBe("user0 user0");
    });

    it("finishes as sent with the counts", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        user.findMany.mockResolvedValue(people(2));

        await processQueuedBroadcasts();

        expect(finalUpdate()).toMatchObject({
            status: "sent", sentCount: 2, failedCount: 0, lastError: null,
        });
        expect(finalUpdate().completedAt).toBeInstanceOf(Date);
    });

    it("still finishes as sent when only some recipients failed", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        user.findMany.mockResolvedValue(people(2));
        sendEmail.mockRejectedValueOnce(new Error("mailbox full"));

        await processQueuedBroadcasts();

        // A partial failure is not a failed broadcast — one bad address must
        // not mark the whole run as undelivered.
        expect(finalUpdate()).toMatchObject({
            status: "sent", sentCount: 1, failedCount: 1, lastError: "mailbox full",
        });
    });

    it("marks the broadcast failed only when nothing got through", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        user.findMany.mockResolvedValue(people(2));
        sendEmail.mockRejectedValue(new Error("provider down"));

        await processQueuedBroadcasts();

        expect(finalUpdate()).toMatchObject({
            status: "failed", sentCount: 0, failedCount: 2,
        });
    });

    it("stringifies a non-Error failure", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        user.findMany.mockResolvedValue(people(1));
        sendEmail.mockRejectedValue("socket hang up");

        await processQueuedBroadcasts();

        expect(finalUpdate().lastError).toBe("socket hang up");
    });

    it("reaches a terminal status even with no recipients", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());

        await processQueuedBroadcasts();

        // Leaving it in "sending" would block the cron on this row forever.
        expect(finalUpdate()).toMatchObject({ status: "sent", sentCount: 0 });
    });

    it("saves progress partway through a long run", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        user.findMany.mockResolvedValue(people(120));

        await processQueuedBroadcasts();

        expect(sendEmail).toHaveBeenCalledTimes(120);
        // claim + at least one progress save + the final update
        expect(emailBroadcast.update.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(finalUpdate()).toMatchObject({ status: "sent", sentCount: 120 });
    });

    it("records the outcome in the log", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        user.findMany.mockResolvedValue(people(1));

        await processQueuedBroadcasts();

        expect(log.info).toHaveBeenCalledWith("broadcast complete", {
            broadcastId: "b1", sent: 1, failed: 0,
        });
    });
});
