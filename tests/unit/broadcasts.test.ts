import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A broadcast fans one message out to every user on the instance. The two
 * things worth pinning are the recipient filter - sending a role-targeted
 * mail to everyone cannot be recalled - and the terminal status, since a
 * run that leaves a row in "sending" forever blocks the cron from ever
 * picking up the next broadcast.
 *
 * The third is how much of the instance it holds while it does that. Queueing
 * read every recipient row in order to write `recipients.length`, and sending
 * read them all again and kept the array for the whole run - which is minutes,
 * because the loop waits 200ms between batches of fifty. Measured for a list of
 * a hundred thousand: 32.5 MB of ids, emails and usernames held for six and a
 * half minutes, and 150.6 MB at half a million.
 */

const { emailBroadcast, user, sendEmail, log } = vi.hoisted(() => ({
    emailBroadcast: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: {
        findMany: vi.fn<(args: {
            where?: Record<string, unknown>;
            take?: number;
            skip?: number;
            cursor?: { id: string };
        }) => Promise<unknown[]>>(),
        count: vi.fn<(args: { where: Record<string, unknown> }) => Promise<number>>(async () => 0),
    },
    sendEmail: vi.fn(async (_opts: { to: string; subject: string; html: string }) => true),
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/core/lib/db", () => ({
    prisma: { emailBroadcast, user },
    default: { emailBroadcast, user },
}));
vi.mock("@/core/lib/email", () => ({ sendEmail }));
vi.mock("@/core/lib/logger", () => ({ 
    errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),log }));

import { queueBroadcast, processQueuedBroadcasts } from "@/core/lib/broadcasts";

function people(count: number, over: Partial<{ email: string }> = {}) {
    return Array.from({ length: count }, (_, i) => ({
        id: `u${i}`,
        email: over.email ?? `u${i}@example.com`,
        username: `user${i}`,
    }));
}


/**
 * Stand the recipient table up behind the cursor the sender actually uses.
 *
 * The double used to answer every read with the same array, which is a table
 * that never ends: the paged sender walked it for ever and the test worker
 * was killed. A double that describes a database nobody has is worse than no
 * double at all.
 */
function recipients(list: { id: string; email: string; username: string }[]) {
    user.findMany.mockImplementation(async (args) => {
        const start = args.cursor ? list.findIndex((p) => p.id === args.cursor!.id) + 1 : 0;
        return list.slice(start, start + (args.take ?? list.length));
    });
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
    user.findMany.mockReset();
    recipients([]);
    user.count.mockReset().mockResolvedValue(0);
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
        user.count.mockResolvedValue(3);

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
        expect(user.count.mock.calls[0]![0].where.isBanned).toBe(false);
    });

    it("targets everyone when the filter says all", async () => {
        await queueBroadcast("b1");

        const where = user.count.mock.calls[0]![0].where;
        expect(where).not.toHaveProperty("id");
        expect(where).not.toHaveProperty("roleId");
    });

    it("targets the named users", async () => {
        emailBroadcast.findUnique.mockResolvedValue(
            broadcastRow({ filter: { userIds: ["u1", "u2"] } }),
        );

        await queueBroadcast("b1");

        expect(user.count.mock.calls[0]![0].where.id).toEqual({ in: ["u1", "u2"] });
    });

    it("targets the named roles", async () => {
        emailBroadcast.findUnique.mockResolvedValue(
            broadcastRow({ filter: { roleIds: ["r1"] } }),
        );

        await queueBroadcast("b1");

        expect(user.count.mock.calls[0]![0].where.roleId).toEqual({ in: ["r1"] });
    });

    it("lets an explicit user list win over a role list", async () => {
        emailBroadcast.findUnique.mockResolvedValue(
            broadcastRow({ filter: { userIds: ["u1"], roleIds: ["r1"] } }),
        );

        await queueBroadcast("b1");

        const where = user.count.mock.calls[0]![0].where;
        expect(where.id).toEqual({ in: ["u1"] });
        expect(where).not.toHaveProperty("roleId");
    });

    it("ignores an empty id list rather than targeting nobody", async () => {
        emailBroadcast.findUnique.mockResolvedValue(
            broadcastRow({ filter: { userIds: [], roleIds: ["r1"] } }),
        );

        await queueBroadcast("b1");

        expect(user.count.mock.calls[0]![0].where.roleId).toEqual({ in: ["r1"] });
    });

    // The guarantee has not changed, only where it is kept. It used to be a
    // `.filter(u => !!u.email)` after the rows were read, which meant the
    // number written here and the people actually sent to could differ by
    // however many blank addresses a bad import had left. It is a condition on
    // the query now, so the count is the send.
    it("leaves out an address nobody can deliver to, in the query itself", async () => {
        await queueBroadcast("b1");

        expect(user.count.mock.calls[0]![0].where.email).toEqual({ not: "" });
    });

    it("asks the sender for the same people it counted", async () => {
        // Both halves must be looking at one broadcast, or this compares the
        // filter of the row being queued with the filter of the row being sent.
        const row = broadcastRow({ filter: { roleIds: ["r1"] } });
        emailBroadcast.findUnique.mockResolvedValue(row);
        emailBroadcast.findFirst.mockResolvedValue(row);
        emailBroadcast.update.mockResolvedValue({});
        emailBroadcast.updateMany.mockResolvedValue({ count: 0 });
        recipients(people(1));

        await queueBroadcast("b1");
        await processQueuedBroadcasts();

        expect(user.findMany.mock.calls[0]![0].where).toEqual(user.count.mock.calls[0]![0].where);
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
        recipients(people(3));

        await processQueuedBroadcasts();

        expect(sendEmail).toHaveBeenCalledTimes(3);
    });

    it("substitutes the recipient's username into the body", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        recipients(people(1));

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
        recipients(people(1));

        await processQueuedBroadcasts();

        expect(sendEmail.mock.calls[0]![0].html).toBe("user0 user0");
    });

    it("finishes as sent with the counts", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        recipients(people(2));

        await processQueuedBroadcasts();

        expect(finalUpdate()).toMatchObject({
            status: "sent", sentCount: 2, failedCount: 0, lastError: null,
        });
        expect(finalUpdate().completedAt).toBeInstanceOf(Date);
    });

    it("still finishes as sent when only some recipients failed", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        recipients(people(2));
        sendEmail.mockRejectedValueOnce(new Error("mailbox full"));

        await processQueuedBroadcasts();

        // A partial failure is not a failed broadcast - one bad address must
        // not mark the whole run as undelivered.
        expect(finalUpdate()).toMatchObject({
            status: "sent", sentCount: 1, failedCount: 1, lastError: "mailbox full",
        });
    });

    it("marks the broadcast failed only when nothing got through", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        recipients(people(2));
        sendEmail.mockRejectedValue(new Error("provider down"));

        await processQueuedBroadcasts();

        expect(finalUpdate()).toMatchObject({
            status: "failed", sentCount: 0, failedCount: 2,
        });
    });

    it("stringifies a non-Error failure", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        recipients(people(1));
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
        recipients(people(120));

        await processQueuedBroadcasts();

        expect(sendEmail).toHaveBeenCalledTimes(120);
        // claim + at least one progress save + the final update
        expect(emailBroadcast.update.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(finalUpdate()).toMatchObject({ status: "sent", sentCount: 120 });
    });

    it("records the outcome in the log", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow());
        recipients(people(1));

        await processQueuedBroadcasts();

        expect(log.info).toHaveBeenCalledWith("broadcast complete", {
            broadcastId: "b1", sent: 1, failed: 0,
        });
    });
});

/**
 * A broadcast the process died in the middle of.
 *
 * `processQueuedBroadcasts` flips the row to `sending` and then spends as
 * long as the recipient list takes, saving progress every five batches. A
 * deploy, a restart or the rebuild an install triggers lands in that window,
 * and the row keeps `sending`: the processor only ever looks for `queued`, so
 * nothing returns to it, and the broadcast screen shows it sending for as
 * long as the database lives.
 *
 * It is not resumed, and that is deliberate. `sentCount` is written every
 * five batches of fifty, so resuming would mail up to two hundred and fifty
 * people a second time, and a broadcast cannot be recalled. A failure an
 * operator can see is the better of the two.
 */
describe("a broadcast left mid-send", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        emailBroadcast.findFirst.mockResolvedValue(null);
        emailBroadcast.updateMany.mockResolvedValue({ count: 0 });
    });

    it("is closed off before the next one is picked up", async () => {
        await processQueuedBroadcasts();

        const sweep = emailBroadcast.updateMany.mock.calls.find(
            ([args]) => (args as { where: { status?: string } }).where.status === "sending",
        );
        expect(sweep, "nothing closes off a stranded send").toBeTruthy();
        const [args] = sweep as [{ data: Record<string, unknown> }];
        expect(args.data.status).toBe("failed");
        expect(args.data.lastError, "an operator needs to be told why").toBeTruthy();
    });

    it("only touches a send that has gone stale", async () => {
        await processQueuedBroadcasts();

        const [args] = emailBroadcast.updateMany.mock.calls.find(
            ([a]) => (a as { where: { status?: string } }).where.status === "sending",
        ) as [{ where: { startedAt?: { lt?: Date } } }];

        const cutoff = args.where.startedAt?.lt;
        expect(cutoff, "without a cutoff this would kill a send in progress").toBeInstanceOf(Date);
        expect(cutoff!.getTime()).toBeLessThan(Date.now());
    });

    it("does not send anything on the way past", async () => {
        await processQueuedBroadcasts();
        expect(sendEmail, "resuming would mail people a second time").not.toHaveBeenCalled();
    });
});

describe("what a broadcast holds while it runs", () => {
    it("counts the recipients without reading them", async () => {
        emailBroadcast.findUnique.mockResolvedValue(broadcastRow({ filter: { all: true } }));
        user.count.mockResolvedValue(120_000);
        emailBroadcast.update.mockResolvedValue({});

        const { totalCount } = await queueBroadcast("b1");

        expect(totalCount).toBe(120_000);
        expect(user.findMany, "queueing wants a number, not a hundred thousand rows").not.toHaveBeenCalled();
    });

    it("counts the same people it would send to", async () => {
        emailBroadcast.findUnique.mockResolvedValue(broadcastRow({ filter: { roleIds: ["r1"] } }));
        user.count.mockResolvedValue(3);
        emailBroadcast.update.mockResolvedValue({});

        await queueBroadcast("b1");

        expect(user.count.mock.calls[0][0]).toMatchObject({
            where: { isBanned: false, roleId: { in: ["r1"] } },
        });
    });

    it("reads the list a page at a time when it sends", async () => {
        emailBroadcast.findFirst.mockResolvedValue(broadcastRow({ filter: { all: true } }));
        emailBroadcast.update.mockResolvedValue({});
        emailBroadcast.updateMany.mockResolvedValue({ count: 0 });
        const everyone = people(120);
        user.findMany.mockImplementation(async (args) => {
            const start = args.cursor ? everyone.findIndex((p) => p.id === args.cursor!.id) + 1 : 0;
            return everyone.slice(start, start + (args.take ?? everyone.length));
        });

        await processQueuedBroadcasts();

        expect(sendEmail).toHaveBeenCalledTimes(120);
        for (const call of user.findMany.mock.calls) {
            expect(call[0].take, "every read is bounded").toBeTypeOf("number");
        }
        expect(user.findMany.mock.calls.length).toBeGreaterThan(1);
    });
});
