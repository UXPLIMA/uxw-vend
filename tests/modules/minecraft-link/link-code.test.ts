// @vitest-environment node
/**
 * Proving someone owns an in-game account without a server plugin.
 *
 * The site whispers a code to the named player over RCON - a private message
 * only that account can read, and only while it is online - and the player
 * types it back. Everything here is about what that proof is worth: the code
 * has to be unguessable, single-use, short-lived, and it must not be possible
 * to grind it.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

interface CodeRow {
    id: string;
    userId: string;
    username: string;
    codeHash: string;
    serverId: string | null;
    attempts: number;
    expiresAt: Date;
    createdAt: Date;
}

const db = { codes: [] as CodeRow[], nextId: 1 };

const prismaMock = {
    minecraftLinkCode: {
        create: vi.fn(async ({ data }: { data: Partial<CodeRow> }) => {
            const row: CodeRow = {
                id: `c${db.nextId++}`,
                userId: data.userId!,
                username: data.username!,
                codeHash: data.codeHash!,
                serverId: data.serverId ?? null,
                attempts: 0,
                expiresAt: data.expiresAt!,
                createdAt: new Date(),
            };
            db.codes.push(row);
            return row;
        }),
        findFirst: vi.fn(async ({ where }: { where: { userId: string } }) =>
            [...db.codes].reverse().find((c) => c.userId === where.userId) ?? null,
        ),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<CodeRow> }) => {
            const row = db.codes.find((c) => c.id === where.id)!;
            Object.assign(row, data);
            return row;
        }),
        delete: vi.fn(async ({ where }: { where: { id: string } }) => {
            db.codes = db.codes.filter((c) => c.id !== where.id);
            return null;
        }),
        deleteMany: vi.fn(async ({ where }: { where: Record<string, { lt?: Date } | string> }) => {
            if (typeof where.userId === "string") {
                db.codes = db.codes.filter((c) => c.userId !== where.userId);
            } else if (where.expiresAt && typeof where.expiresAt === "object" && where.expiresAt.lt) {
                const cutoff = where.expiresAt.lt;
                db.codes = db.codes.filter((c) => c.expiresAt >= cutoff);
            }
            return { count: 0 };
        }),
    },
};

vi.mock("@/core/sdk/server", () => ({ prisma: prismaMock }));

const { generateCode, issueCode, redeemCode, hashCode, MAX_ATTEMPTS } = await import(
    "@/modules/minecraft-link/lib/link-code"
);

beforeEach(() => {
    db.codes = [];
    db.nextId = 1;
    vi.clearAllMocks();
});

describe("generateCode", () => {
    it("is six characters the player can read out of a chat line", () => {
        expect(generateCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    });

    // 0/O and 1/I/L are the pairs people mistype when copying from chat.
    it("leaves out the characters that get confused for each other", () => {
        const sample = Array.from({ length: 200 }, generateCode).join("");
        expect(sample).not.toMatch(/[0O1IL]/);
    });

    it("does not repeat itself", () => {
        const codes = new Set(Array.from({ length: 500 }, generateCode));
        expect(codes.size).toBeGreaterThan(495);
    });
});

describe("issueCode", () => {
    it("stores the hash, never the code", async () => {
        const code = await issueCode({ userId: "u1", username: "Notch" });
        expect(db.codes[0].codeHash).toBe(hashCode(code));
        expect(db.codes[0].codeHash).not.toBe(code);
    });

    // Otherwise asking for a new code would leave the old one live, and every
    // request would widen the window instead of restarting it.
    it("replaces the code a user already had outstanding", async () => {
        const first = await issueCode({ userId: "u1", username: "Notch" });
        await issueCode({ userId: "u1", username: "Notch" });
        expect(db.codes).toHaveLength(1);
        await expect(redeemCode("u1", first)).resolves.toMatchObject({ ok: false });
    });

    it("does not touch another user's pending code", async () => {
        await issueCode({ userId: "u1", username: "Notch" });
        const other = await issueCode({ userId: "u2", username: "Jeb" });
        expect(db.codes).toHaveLength(2);
        await expect(redeemCode("u2", other)).resolves.toEqual({ ok: true, username: "Jeb" });
    });
});

describe("redeemCode", () => {
    it("returns the name the code was whispered to", async () => {
        const code = await issueCode({ userId: "u1", username: "Notch" });
        await expect(redeemCode("u1", code)).resolves.toEqual({ ok: true, username: "Notch" });
    });

    it("accepts the code however the player typed it", async () => {
        const code = await issueCode({ userId: "u1", username: "Notch" });
        await expect(redeemCode("u1", `  ${code.toLowerCase()}  `)).resolves.toEqual({
            ok: true,
            username: "Notch",
        });
    });

    it("works once", async () => {
        const code = await issueCode({ userId: "u1", username: "Notch" });
        await redeemCode("u1", code);
        await expect(redeemCode("u1", code)).resolves.toEqual({ ok: false, reason: "not-found" });
    });

    it("refuses an expired code and clears it", async () => {
        const code = await issueCode({ userId: "u1", username: "Notch" });
        db.codes[0].expiresAt = new Date(Date.now() - 1000);
        await expect(redeemCode("u1", code)).resolves.toEqual({ ok: false, reason: "expired" });
        expect(db.codes).toEqual([]);
    });

    // A code whispered to one player must not be redeemable by whoever else
    // happens to have seen it.
    it("is bound to the user who asked for it", async () => {
        const code = await issueCode({ userId: "u1", username: "Notch" });
        await expect(redeemCode("u2", code)).resolves.toEqual({ ok: false, reason: "not-found" });
        expect(db.codes).toHaveLength(1);
    });

    it("burns the request after too many wrong guesses", async () => {
        await issueCode({ userId: "u1", username: "Notch" });
        for (let i = 1; i < MAX_ATTEMPTS; i++) {
            await expect(redeemCode("u1", "WRONG1")).resolves.toMatchObject({
                ok: false,
                attemptsLeft: MAX_ATTEMPTS - i,
            });
        }
        await expect(redeemCode("u1", "WRONG1")).resolves.toEqual({ ok: false, reason: "too-many-attempts" });
        expect(db.codes).toEqual([]);
    });

    // Guessing has to cost the guesser their own pending link, not somebody
    // else's, or it becomes a way to lock other people out.
    it("spends the guesser's own attempts, not the victim's", async () => {
        await issueCode({ userId: "victim", username: "Notch" });
        await issueCode({ userId: "attacker", username: "Attacker" });
        for (let i = 0; i < MAX_ATTEMPTS; i++) await redeemCode("attacker", "WRONG1");
        expect(db.codes.map((c) => c.userId)).toEqual(["victim"]);
    });

    it("says so when there is nothing pending", async () => {
        await expect(redeemCode("u1", "ABC123")).resolves.toEqual({ ok: false, reason: "not-found" });
    });
});
