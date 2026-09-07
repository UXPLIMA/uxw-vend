// @vitest-environment node
/**
 * An operator who backs up elsewhere can switch the nightly backup off.
 *
 * `core:automated-backup` is registered on every install and runs every day.
 * It shells out to `pg_dump`, which is present in the runtime image and absent
 * from plenty of other places a person runs this - a bare Node host with the
 * database in a container, for one. There it fails every night, for ever:
 * measured on the development box, `CronRun` held `lastStatus = error` and
 * `spawn pg_dump ENOENT` from a run nobody was watching.
 *
 * The failure is recorded deliberately - a backup that silently reports `ok`
 * while `backups/` stays empty is the worse bug, and that one has already been
 * fixed once. What was missing is the other answer: an install that does not
 * want this job at all had no way to say so, so the only honest state
 * available to it was a permanent error.
 *
 * The switch defaults to on, because every install that exists today has the
 * job running and a default of off would quietly stop backing them up.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const settings = new Map<string, unknown>();
let backupFails = true;
let readFails = false;
const attempts: string[] = [];

const setting = {
    findUnique: async ({ where }: { where: { key: string } }) => {
        if (readFails) throw new Error("connection refused");
        return settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null;
    },
    upsert: async ({ where, create, update }: {
        where: { key: string };
        create: { key: string; value: unknown };
        update: { value: unknown };
    }) => {
        const value = settings.has(where.key) ? update.value : create.value;
        settings.set(where.key, value);
        return { key: where.key, value };
    },
};

vi.mock("@/core/lib/db", () => ({ prisma: { setting }, default: { prisma: { setting } } }));
let user: { id: string; role: string } | null = { id: "admin1", role: "admin" };
let admin = true;

vi.mock("@/core/lib/auth", () => ({ auth: async () => (user ? { user } : null) }));
vi.mock("@/core/lib/permissions", () => ({ isAdmin: async () => admin }));
vi.mock("@/core/lib/activity-log", () => ({ logActivity: () => undefined }));
vi.mock("@/core/lib/backup", () => ({
    listBackups: async () => [],
    formatBytes: (n: number) => `${n} B`,
    createBackup: async (type: string) => {
        attempts.push(type);
        if (backupFails) throw new Error("pg_dump was not found on the server.");
        return { id: "b1", filename: "b1.sql.gz", sizeBytes: 10, createdAt: new Date(), type };
    },
}));
vi.mock("@/core/lib/logger", () => ({
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

const {
    isAutomatedBackupEnabled,
    setAutomatedBackupEnabled,
    runScheduledBackup,
} = await import("@/core/lib/backup-schedule");
const { GET, PATCH } = await import("@/app/api/v1/admin/backup/route");
const { NextRequest } = await import("next/server");

beforeEach(() => {
    settings.clear();
    attempts.length = 0;
    backupFails = true;
    readFails = false;
    user = { id: "admin1", role: "admin" };
    admin = true;
});

const patch = (body: unknown) =>
    PATCH(
        new NextRequest("http://example.com/api/v1/admin/backup", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        }),
    );

describe("the nightly backup", () => {
    it("runs on an install that never chose, which is every install today", async () => {
        expect(await isAutomatedBackupEnabled()).toBe(true);
        await expect(runScheduledBackup()).rejects.toThrow(/pg_dump/);
        expect(attempts).toEqual(["scheduled"]);
    });

    it("does not run, and does not fail, once it is switched off", async () => {
        await setAutomatedBackupEnabled(false);
        await expect(runScheduledBackup()).resolves.toBeUndefined();
        expect(attempts).toEqual([]);
    });

    it("comes back when it is switched on again", async () => {
        await setAutomatedBackupEnabled(false);
        await setAutomatedBackupEnabled(true);
        expect(await isAutomatedBackupEnabled()).toBe(true);
        await expect(runScheduledBackup()).rejects.toThrow(/pg_dump/);
    });

    it("still reports a real failure when it is switched on", async () => {
        // The switch is for "I back up elsewhere", not for hiding a broken
        // backup: an enabled job that cannot dump still fails loudly.
        await setAutomatedBackupEnabled(true);
        await expect(runScheduledBackup()).rejects.toThrow();
    });

    it("succeeds quietly when the dump works", async () => {
        backupFails = false;
        await expect(runScheduledBackup()).resolves.toBeUndefined();
        expect(attempts).toEqual(["scheduled"]);
    });

    it("keeps running when the setting cannot be read at all", async () => {
        // A database that cannot answer must not be read as "switched off":
        // that would turn a database blip into a night with no backup.
        readFails = true;
        expect(await isAutomatedBackupEnabled()).toBe(true);
        await expect(runScheduledBackup()).rejects.toThrow(/pg_dump/);
    });
});

describe("the switch on the backup screen", () => {
    it("turns the nightly job off and the job stays off", async () => {
        const res = await patch({ automated: false });
        expect(res.status).toBe(200);
        expect(await isAutomatedBackupEnabled()).toBe(false);
        await expect(runScheduledBackup()).resolves.toBeUndefined();
    });

    it("reports the current answer, so the screen shows what is really set", async () => {
        await setAutomatedBackupEnabled(false);
        const body = (await (await GET()).json()) as { automated: { enabled: boolean } };
        expect(body.automated.enabled).toBe(false);
    });

    it("is not something a signed-in member can flip", async () => {
        admin = false;
        expect((await patch({ automated: false })).status).toBe(403);
        expect(await isAutomatedBackupEnabled()).toBe(true);
    });

    it("is not something a stranger can flip", async () => {
        user = null;
        expect((await patch({ automated: false })).status).toBe(401);
        expect(await isAutomatedBackupEnabled()).toBe(true);
    });

    it("refuses a body that does not say yes or no", async () => {
        expect((await patch({ automated: "off" })).status).toBe(400);
        expect((await patch({})).status).toBe(400);
        expect(await isAutomatedBackupEnabled()).toBe(true);
    });
});
