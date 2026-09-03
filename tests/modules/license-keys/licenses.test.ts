// @vitest-environment node
/**
 * Issuing a key and answering "may this machine run the product?".
 *
 * The answers here are the ones a customer feels: a key that stops working
 * after a refund, a laptop that does not burn a second seat every time the app
 * launches, a reinstall that works because the old machine was released.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

interface KeyRow {
    id: string;
    keyHash: string;
    keySealed: string;
    keyHint: string;
    productId: string | null;
    productName: string | null;
    orderId: string | null;
    userId: string | null;
    status: string;
    maxActivations: number;
    expiresAt: Date | null;
    note: string | null;
    createdAt: Date;
}

interface ActivationRow {
    id: string;
    licenseKeyId: string;
    machineHash: string;
    label: string | null;
    activatedAt: Date;
    lastSeenAt: Date;
}

const db = { keys: [] as KeyRow[], activations: [] as ActivationRow[], next: 1 };

/** Set by a test that wants the unique index to fire on the next create. */
let failNextActivation = false;

const prismaMock = {
    licenseKey: {
        create: vi.fn(async ({ data }: { data: Partial<KeyRow> }) => {
            const row: KeyRow = {
                id: `k${db.next++}`,
                keyHash: data.keyHash!,
                keySealed: data.keySealed!,
                keyHint: data.keyHint!,
                productId: data.productId ?? null,
                productName: data.productName ?? null,
                orderId: data.orderId ?? null,
                userId: data.userId ?? null,
                status: data.status ?? "active",
                maxActivations: data.maxActivations ?? 1,
                expiresAt: data.expiresAt ?? null,
                note: data.note ?? null,
                createdAt: new Date(),
            };
            db.keys.push(row);
            return row;
        }),
        findUnique: vi.fn(async ({ where, include }: { where: { keyHash: string }; include?: unknown }) => {
            const row = db.keys.find((k) => k.keyHash === where.keyHash);
            if (!row) return null;
            if (!include) return row;
            return { ...row, activations: db.activations.filter((a) => a.licenseKeyId === row.id) };
        }),
    },
    licenseActivation: {
        create: vi.fn(async ({ data }: { data: Partial<ActivationRow> }) => {
            if (failNextActivation) {
                failNextActivation = false;
                throw new Error("Unique constraint failed on the fields: (licenseKeyId, machineHash)");
            }
            const row: ActivationRow = {
                id: `a${db.next++}`,
                licenseKeyId: data.licenseKeyId!,
                machineHash: data.machineHash!,
                label: data.label ?? null,
                activatedAt: new Date(),
                lastSeenAt: new Date(),
            };
            db.activations.push(row);
            return row;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<ActivationRow> }) => {
            const row = db.activations.find((a) => a.id === where.id)!;
            Object.assign(row, data);
            return row;
        }),
        deleteMany: vi.fn(async ({ where }: { where: { licenseKeyId: string; machineHash: string } }) => {
            const before = db.activations.length;
            db.activations = db.activations.filter(
                (a) => !(a.licenseKeyId === where.licenseKeyId && a.machineHash === where.machineHash),
            );
            return { count: before - db.activations.length };
        }),
    },
};

vi.mock("@/core/sdk/server", () => ({
    prisma: prismaMock,
    encryptSecret: (value: string) => `enc:${Buffer.from(value).toString("base64")}`,
    decryptSecret: (value: string) => Buffer.from(value.slice(4), "base64").toString("utf8"),
}));

const { issueKey, issueKeys, revealKey, checkLicense, releaseActivation } = await import(
    "@/modules/license-keys/lib/licenses"
);
const { hashKey, hashMachine, normalizeKey } = await import("@/modules/license-keys/lib/key");

beforeEach(() => {
    db.keys = [];
    db.activations = [];
    db.next = 1;
    failNextActivation = false;
    vi.clearAllMocks();
});

const DAY = 24 * 60 * 60 * 1000;

describe("issueKey", () => {
    it("stores the hash, not the key", async () => {
        const { key } = await issueKey({});
        expect(db.keys[0].keyHash).toBe(hashKey(key));
        expect(db.keys[0].keyHash).not.toContain(normalizeKey(key).slice(0, 5));
    });

    // The owner has to be able to read it back, so a second copy is kept -
    // encrypted, so that the hash column is not the only thing protecting it.
    it("keeps a sealed copy the owner can read back", async () => {
        const { key } = await issueKey({});
        expect(db.keys[0].keySealed).not.toContain(key);
        expect(revealKey(db.keys[0].keySealed)).toBe(key);
    });

    it("records a hint an admin can match without seeing the key", async () => {
        const { key, hint } = await issueKey({});
        expect(key.startsWith(hint)).toBe(true);
        expect(hint.length).toBeLessThan(key.length);
    });

    it("turns a validity window into a date", async () => {
        await issueKey({ validDays: 30 });
        const expires = db.keys[0].expiresAt!.getTime();
        expect(expires).toBeGreaterThan(Date.now() + 29 * DAY);
        expect(expires).toBeLessThan(Date.now() + 31 * DAY);
    });

    it("leaves a key without a validity window open ended", async () => {
        await issueKey({});
        expect(db.keys[0].expiresAt).toBeNull();
    });

    // A zero here means "no expiry", not "expired the moment it was issued".
    it("does not expire a key that was issued for zero days", async () => {
        await issueKey({ validDays: 0 });
        expect(db.keys[0].expiresAt).toBeNull();
    });

    it("never issues a key nobody can activate", async () => {
        await issueKey({ maxActivations: 0 });
        expect(db.keys[0].maxActivations).toBe(1);
    });
});

describe("issueKeys", () => {
    it("mints a batch of distinct keys", async () => {
        const issued = await issueKeys(5, { productName: "Editor Pro" });
        expect(new Set(issued.map((k) => k.key)).size).toBe(5);
        expect(db.keys.every((k) => k.productName === "Editor Pro")).toBe(true);
    });

    it("mints nothing for a nonsense count", async () => {
        expect(await issueKeys(-3, {})).toEqual([]);
        expect(db.keys).toHaveLength(0);
    });
});

describe("checkLicense", () => {
    it("accepts a key that was just issued", async () => {
        const { key } = await issueKey({ productName: "Editor Pro" });
        await expect(checkLicense(key)).resolves.toMatchObject({ ok: true, productName: "Editor Pro" });
    });

    it("accepts the key however the customer retyped it", async () => {
        const { key } = await issueKey({});
        await expect(checkLicense(key.toLowerCase().replace(/-/g, " "))).resolves.toMatchObject({ ok: true });
    });

    // This endpoint is public. "Not a key" and "a key that was cancelled" have
    // to look alike from outside, or it becomes an oracle for guessing keys.
    it("says only that an unknown key is unknown", async () => {
        await expect(checkLicense("ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ")).resolves.toEqual({ ok: false, reason: "unknown" });
    });

    it("refuses a revoked key", async () => {
        const { key } = await issueKey({});
        db.keys[0].status = "revoked";
        await expect(checkLicense(key)).resolves.toEqual({ ok: false, reason: "revoked" });
    });

    it("refuses a key whose term has run out", async () => {
        const { key } = await issueKey({});
        db.keys[0].expiresAt = new Date(Date.now() - 1000);
        await expect(checkLicense(key)).resolves.toEqual({ ok: false, reason: "expired" });
    });

    it("still honours a key on its last day", async () => {
        const { key } = await issueKey({ validDays: 1 });
        await expect(checkLicense(key)).resolves.toMatchObject({ ok: true });
    });

    it("looks without touching when no machine is named", async () => {
        const { key } = await issueKey({});
        const result = await checkLicense(key);
        expect(result).toMatchObject({ ok: true, activationsUsed: 0, newActivation: false });
        expect(db.activations).toHaveLength(0);
    });
});

describe("activation", () => {
    it("claims a seat for a machine it has not seen", async () => {
        const { key } = await issueKey({ maxActivations: 2 });
        const result = await checkLicense(key, { machineId: "laptop", label: "Work laptop" });
        expect(result).toMatchObject({ ok: true, activationsUsed: 1, newActivation: true });
        expect(db.activations[0].machineHash).toBe(hashMachine("laptop"));
        expect(db.activations[0].label).toBe("Work laptop");
    });

    it("keeps the fingerprint out of the row", async () => {
        const { key } = await issueKey({});
        await checkLicense(key, { machineId: "SERIAL-4471" });
        expect(JSON.stringify(db.activations)).not.toContain("SERIAL-4471");
    });

    // Software calls this on every launch. Charging a seat each time would let
    // a customer exhaust their activations by using the product they bought.
    it("does not charge a machine twice", async () => {
        const { key } = await issueKey({ maxActivations: 1 });
        await checkLicense(key, { machineId: "laptop" });
        const again = await checkLicense(key, { machineId: "laptop" });
        expect(again).toMatchObject({ ok: true, activationsUsed: 1, newActivation: false });
        expect(db.activations).toHaveLength(1);
    });

    it("notes that the machine is still in use", async () => {
        const { key } = await issueKey({});
        await checkLicense(key, { machineId: "laptop" });
        const seenAt = db.activations[0].lastSeenAt;
        db.activations[0].lastSeenAt = new Date(Date.now() - DAY);
        await checkLicense(key, { machineId: "laptop" });
        expect(db.activations[0].lastSeenAt.getTime()).toBeGreaterThanOrEqual(seenAt.getTime() - 1000);
    });

    it("turns away a machine past the limit", async () => {
        const { key } = await issueKey({ maxActivations: 2 });
        await checkLicense(key, { machineId: "one" });
        await checkLicense(key, { machineId: "two" });
        await expect(checkLicense(key, { machineId: "three" })).resolves.toEqual({
            ok: false,
            reason: "activation-limit",
        });
        expect(db.activations).toHaveLength(2);
    });

    // Two launches at once on the same machine race for the same seat. The
    // unique index settles it, and the loser is already activated.
    it("treats a lost race as an activation that already happened", async () => {
        const { key } = await issueKey({ maxActivations: 2 });
        failNextActivation = true;
        await expect(checkLicense(key, { machineId: "laptop" })).resolves.toMatchObject({
            ok: true,
            newActivation: false,
        });
    });

    it("will not activate a revoked key even for a machine it knows", async () => {
        const { key } = await issueKey({});
        await checkLicense(key, { machineId: "laptop" });
        db.keys[0].status = "revoked";
        await expect(checkLicense(key, { machineId: "laptop" })).resolves.toEqual({
            ok: false,
            reason: "revoked",
        });
    });
});

describe("releaseActivation", () => {
    // The reason this exists: a customer replaces their machine and would
    // otherwise be locked out of the product they paid for.
    it("frees the seat so another machine can take it", async () => {
        const { key } = await issueKey({ maxActivations: 1 });
        await checkLicense(key, { machineId: "old-laptop" });
        await expect(checkLicense(key, { machineId: "new-laptop" })).resolves.toMatchObject({ ok: false });

        expect(await releaseActivation(key, "old-laptop")).toBe(true);
        await expect(checkLicense(key, { machineId: "new-laptop" })).resolves.toMatchObject({
            ok: true,
            newActivation: true,
        });
    });

    it("reports nothing freed when the machine never held a seat", async () => {
        const { key } = await issueKey({});
        expect(await releaseActivation(key, "never-seen")).toBe(false);
    });

    it("reports nothing freed for a key that does not exist", async () => {
        expect(await releaseActivation("ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ", "laptop")).toBe(false);
    });

    it("leaves another machine's seat alone", async () => {
        const { key } = await issueKey({ maxActivations: 2 });
        await checkLicense(key, { machineId: "one" });
        await checkLicense(key, { machineId: "two" });
        await releaseActivation(key, "one");
        expect(db.activations).toHaveLength(1);
        expect(db.activations[0].machineHash).toBe(hashMachine("two"));
    });
});
