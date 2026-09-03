import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The pre-install snapshot is the only thing standing between a half-applied
 * schema merge and an unrecoverable database. Its whole contract is that it
 * is opt-in and that it can never block an install - a backup helper that
 * throws would turn a recoverable install failure into a broken instance.
 */

const { createBackup } = vi.hoisted(() => ({ createBackup: vi.fn() }));

vi.mock("@/core/lib/backup", () => ({ createBackup }));

vi.mock("@/core/lib/logger", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const META = { filename: "backup-2026-09-01.sql.gz", sizeBytes: 1234 };

beforeEach(() => {
    createBackup.mockReset();
    createBackup.mockResolvedValue(META);
    vi.spyOn(console, "error").mockImplementation(() => { });
    vi.stubEnv("MODULE_INSTALL_BACKUP", "1");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/uxwvend");
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

async function backupBeforeModuleChange(
    action: "install" | "update" | "uninstall",
    moduleId: string,
) {
    const mod = await import("@/core/lib/module-backup");
    return mod.backupBeforeModuleChange(action, moduleId);
}

describe("backupBeforeModuleChange", () => {
    it("snapshots with a label naming the action and the module", async () => {
        const meta = await backupBeforeModuleChange("install", "blog");

        expect(createBackup).toHaveBeenCalledWith("manual", "pre-install:blog");
        // The label is how an operator finds the right snapshot at 3am.
        expect(meta).toBe(META);
    });

    it.each(["install", "update", "uninstall"] as const)(
        "labels a %s snapshot with its own action",
        async (action) => {
            await backupBeforeModuleChange(action, "store");
            expect(createBackup).toHaveBeenCalledWith("manual", `pre-${action}:store`);
        },
    );

    it("is off unless MODULE_INSTALL_BACKUP is exactly 1", async () => {
        vi.stubEnv("MODULE_INSTALL_BACKUP", "true");

        expect(await backupBeforeModuleChange("install", "blog")).toBeNull();
        // pg_dump is not on every runtime image; a truthy-looking value must
        // not silently opt an instance into a path that cannot work there.
        expect(createBackup).not.toHaveBeenCalled();
    });

    it("is off when MODULE_INSTALL_BACKUP is unset", async () => {
        vi.stubEnv("MODULE_INSTALL_BACKUP", undefined);

        expect(await backupBeforeModuleChange("install", "blog")).toBeNull();
        expect(createBackup).not.toHaveBeenCalled();
    });

    it("does nothing without a DATABASE_URL", async () => {
        vi.stubEnv("DATABASE_URL", undefined);

        expect(await backupBeforeModuleChange("install", "blog")).toBeNull();
        // During the setup wizard there is no database to dump yet.
        expect(createBackup).not.toHaveBeenCalled();
    });

    it("swallows a backup failure so the install still runs", async () => {
        createBackup.mockRejectedValue(new Error("pg_dump: command not found"));

        // The operator can still back up by hand from the admin UI; refusing
        // to install because the optional snapshot failed helps nobody.
        await expect(backupBeforeModuleChange("install", "blog")).resolves.toBeNull();
    });

    it("swallows a thrown non-Error too", async () => {
        createBackup.mockRejectedValue("exit status 127");

        await expect(backupBeforeModuleChange("uninstall", "forum")).resolves.toBeNull();
    });
});
