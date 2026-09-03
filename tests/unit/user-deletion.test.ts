import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * "Right to be forgotten" is irreversible and legally load-bearing: too
 * little deletion is a GDPR failure, too much destroys the public record
 * (forum topics, orders, moderation history) that the design deliberately
 * keeps. Neither direction is recoverable once it has run, and until now
 * nothing tested either.
 */

interface DeleteCall { model: string; where: Record<string, unknown> }

const deleteCalls: DeleteCall[] = [];
let userRow: { id: string; isDeleted: boolean } | null;
let updateArgs: { where: unknown; data: Record<string, unknown> } | null;
let updateThrows: unknown = null;
let findThrows: unknown = null;
/** Models whose deleteMany rejects, keyed by model name. */
let failingModels: Set<string>;
/** Models the generated client exposes. Anything else is "not installed". */
let installedModels: Set<string>;
/** Client properties that exist but are not delegates (e.g. $extends). */
let bogusModels: Set<string>;
/** Ordered log of every write, so purge-before-anonymise is observable. */
let opLog: string[];

function makeDelegate(model: string) {
    return {
        deleteMany: async (args: { where: Record<string, unknown> }) => {
            if (failingModels.has(model)) throw new Error(`${model} is gone`);
            opLog.push(`delete:${model}`);
            deleteCalls.push({ model, where: args.where });
            return { count: 1 };
        },
    };
}

vi.mock("@/core/lib/db", () => {
    const target = {
        user: {
            findUnique: async () => {
                if (findThrows) throw findThrows;
                return userRow;
            },
            update: async (args: { where: unknown; data: Record<string, unknown> }) => {
                if (updateThrows) throw updateThrows;
                opLog.push("update:user");
                updateArgs = args;
                return {};
            },
        },
    } as Record<string, unknown>;

    // A Proxy stands in for the generated Prisma client: which model
    // delegates exist depends on which modules are installed, and the
    // module under test probes for them by string.
    const prisma = new Proxy(target, {
        get(obj, prop: string) {
            if (prop in obj) return obj[prop];
            if (bogusModels.has(prop)) return { $extends: () => { } };
            if (installedModels.has(prop)) return makeDelegate(prop);
            return undefined;
        },
        has(obj, prop: string) {
            return prop in obj || installedModels.has(prop) || bogusModels.has(prop);
        },
    });

    return { prisma };
});

const ALL_PRIVATE_MODELS = [
    "userSession", "linkedAccount", "notificationPreference", "account",
    "session", "apiKey", "notification", "cartItem", "message",
    "conversationParticipant", "forumTopicLike", "forumPostLike", "suggestionVote",
];

/** Models the design says must survive an erasure. */
const PUBLIC_RECORD_MODELS = [
    "forumTopic", "forumPost", "blogArticle", "order", "userWarning",
    "activityFeedItem", "supportTicket", "revision",
];

beforeEach(() => {
    deleteCalls.length = 0;
    userRow = { id: "usr_1", isDeleted: false };
    updateArgs = null;
    updateThrows = null;
    findThrows = null;
    failingModels = new Set();
    bogusModels = new Set();
    opLog = [];
    installedModels = new Set([...ALL_PRIVATE_MODELS, ...PUBLIC_RECORD_MODELS]);
});

async function softDeleteUser(...args: [string, string?]) {
    const mod = await import("@/core/lib/user-deletion");
    return mod.softDeleteUser(...args);
}

describe("softDeleteUser", () => {
    it("purges every private model on the user's own column", async () => {
        const result = await softDeleteUser("usr_1");

        expect(result).toEqual({ success: true });
        expect(deleteCalls.map((c) => c.model)).toEqual(ALL_PRIVATE_MODELS);
        // `message` joins through authorId, not userId - a copy/paste of the
        // wrong column would delete nothing and leave DMs behind.
        expect(deleteCalls.find((c) => c.model === "message")!.where).toEqual({ authorId: "usr_1" });
        expect(deleteCalls.find((c) => c.model === "userSession")!.where).toEqual({ userId: "usr_1" });
    });

    it("leaves the public record and moderation history intact", async () => {
        await softDeleteUser("usr_1");

        // Deleting these would take out other people's threads and the
        // evidence behind bans. The join now resolves to the anonymised row.
        for (const model of PUBLIC_RECORD_MODELS) {
            expect(deleteCalls.some((c) => c.model === model)).toBe(false);
        }
    });

    it("anonymises the user row in place rather than deleting it", async () => {
        await softDeleteUser("usr_1", "spam");

        expect(updateArgs!.where).toEqual({ id: "usr_1" });
        expect(updateArgs!.data).toMatchObject({
            email: "deleted-usr_1@anonymous.local",
            username: "deleted-user-usr_1",
            avatar: null,
            password: "",
            isDeleted: true,
            banReason: "spam",
        });
        expect(updateArgs!.data.deletedAt).toBeInstanceOf(Date);
    });

    it("derives an email and username that keep the unique constraints satisfied", async () => {
        await softDeleteUser("cuid_aaaaaaaaaaaaaaaa");
        const first = updateArgs!.data;

        deleteCalls.length = 0;
        userRow = { id: "cuid_bbbbbbbbbbbbbbbb", isDeleted: false };
        await softDeleteUser("cuid_bbbbbbbbbbbbbbbb");

        // Two erasures must not collide on User.email / User.username; the
        // second would fail and leave a half-purged account behind.
        expect(updateArgs!.data.email).not.toBe(first.email);
        expect(updateArgs!.data.username).not.toBe(first.username);
        expect(updateArgs!.data.username).toBe("deleted-user-cuid_bbb");
    });

    it("stores no ban reason when none was given", async () => {
        await softDeleteUser("usr_1");
        expect(updateArgs!.data.banReason).toBeNull();
    });

    it("purges before anonymising", async () => {
        await softDeleteUser("usr_1");

        // If anonymisation went first and then something threw, the account
        // would already be unreachable while its private data was still
        // there - the worst of both outcomes.
        expect(opLog[opLog.length - 1]).toBe("update:user");
        expect(opLog.slice(0, -1).every((op) => op.startsWith("delete:"))).toBe(true);
    });

    it("refuses an unknown user without touching anything", async () => {
        userRow = null;

        expect(await softDeleteUser("nope")).toEqual({
            success: false,
            error: "User not found",
        });
        expect(deleteCalls).toHaveLength(0);
        expect(updateArgs).toBeNull();
    });

    it("is idempotent: a second erasure is refused, not re-run", async () => {
        userRow = { id: "usr_1", isDeleted: true };

        expect(await softDeleteUser("usr_1")).toEqual({
            success: false,
            error: "User already deleted",
        });
        // Re-running would rewrite deletedAt and lose the original erasure
        // timestamp, which is the one thing a regulator asks for.
        expect(updateArgs).toBeNull();
        expect(deleteCalls).toHaveLength(0);
    });

    it("skips models the installed modules do not provide", async () => {
        installedModels = new Set(["userSession", "account"]);

        expect(await softDeleteUser("usr_1")).toEqual({ success: true });
        expect(deleteCalls.map((c) => c.model)).toEqual(["userSession", "account"]);
        expect(updateArgs).not.toBeNull();
    });

    it("skips a client property that exists but has no deleteMany", async () => {
        installedModels = new Set(["userSession"]);
        // The Prisma client carries non-model properties ($extends, $connect)
        // alongside the delegates; a name collision must not be called.
        bogusModels = new Set(["notification", "apiKey"]);

        expect(await softDeleteUser("usr_1")).toEqual({ success: true });
        expect(deleteCalls.map((c) => c.model)).toEqual(["userSession"]);
        expect(updateArgs).not.toBeNull();
    });

    it("continues past a delegate whose delete fails", async () => {
        failingModels = new Set(["notification", "cartItem"]);

        expect(await softDeleteUser("usr_1")).toEqual({ success: true });
        // The two failures must not cost us the eleven that would succeed,
        // nor the anonymisation that is the point of the operation.
        expect(deleteCalls).toHaveLength(ALL_PRIVATE_MODELS.length - 2);
        expect(updateArgs).not.toBeNull();
    });

    it("reports the error when the anonymising update fails", async () => {
        updateThrows = new Error("unique constraint violated");

        expect(await softDeleteUser("usr_1")).toEqual({
            success: false,
            error: "unique constraint violated",
        });
    });

    it("reports a lookup failure rather than throwing", async () => {
        findThrows = new Error("connection refused");

        expect(await softDeleteUser("usr_1")).toEqual({
            success: false,
            error: "connection refused",
        });
        expect(deleteCalls).toHaveLength(0);
    });

    it("survives a thrown non-Error", async () => {
        updateThrows = "just a string";

        expect(await softDeleteUser("usr_1")).toEqual({
            success: false,
            error: "Unknown error",
        });
    });
});
