// @vitest-environment node
/**
 * Who decides that an update happened.
 *
 * Not the updater: it has no database, and no idea whether the site was in
 * maintenance before it started. Not the panel either - the process that asked
 * for the update is the one being replaced. The first thing that can say the
 * update arrived is the boot after the swap, because the process saying so is
 * the new version.
 *
 * So the boot closes the record, and takes the site back out of maintenance if
 * this update was what put it there. A failed update boots the old version
 * again with the updater's word already on the volume, and the same pass reads
 * that and closes it the other way.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let dir: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "uxw-boot-"));
    process.env.UXWVEND_UPDATE_DIR = dir;
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.UXWVEND_UPDATE_DIR;
});

const { writeIntent, readIntent, reconcileUpdate } = await import("@/core/lib/core-update");

const release = {
    version: "0.3.0",
    tag: "0.3.0",
    publishedAt: "2026-09-01T00:00:00Z",
    notes: "",
    security: false,
    channel: "stable" as const,
    minVersion: null,
};

async function requested(maintenanceRestore = true) {
    await writeIntent({ release, fromVersion: "0.2.1", requestedBy: "admin-1", maintenanceRestore });
}

const noop = async () => undefined;

describe("the boot after an update", () => {
    it("closes it when the version running is the one that was asked for", async () => {
        await requested();
        const seen: string[] = [];

        const result = await reconcileUpdate("0.3.0", async (outcome) => { seen.push(outcome); });

        expect(result).toEqual({ outcome: "done", reopened: true });
        expect(seen).toEqual(["done"]);
    });

    it("says nothing when this boot is still the old version", async () => {
        await requested();
        expect(await reconcileUpdate("0.2.1", noop)).toEqual({ outcome: null, reopened: false });
    });

    it("closes it the other way when the updater gave up", async () => {
        await requested();
        fs.writeFileSync(path.join(dir, "status"), "failed");

        const result = await reconcileUpdate("0.2.1", noop);

        expect(result.outcome).toBe("failed");
        expect(result.reopened).toBe(true);
    });

    it("leaves a site alone that was already closed before the update", async () => {
        await requested(false);
        expect((await reconcileUpdate("0.3.0", noop)).reopened).toBe(false);
    });

    it("does not close the same update twice, however often it boots", async () => {
        await requested();
        const seen: string[] = [];
        const record = async (outcome: string) => { seen.push(outcome); };

        await reconcileUpdate("0.3.0", async (o) => record(o));
        await reconcileUpdate("0.3.0", async (o) => record(o));
        await reconcileUpdate("0.3.0", async (o) => record(o));

        expect(seen).toEqual(["done"]);
        expect((await readIntent())?.finishedAt).toBeTruthy();
    });

    it("has nothing to say on a boot with no update behind it", async () => {
        expect(await reconcileUpdate("0.2.1", noop)).toEqual({ outcome: null, reopened: false });
    });
});
