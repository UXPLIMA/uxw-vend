// @vitest-environment node
/**
 * How the panel asks for an update, and what it is not allowed to ask for.
 *
 * The app container does not hold the Docker socket - that is root on the
 * host - so it cannot update itself. It writes an intent into a directory
 * shared with the updater, which is the only thing in the stack that can pull
 * an image and recreate a container. That makes the intent file a trust
 * boundary in both directions: the tag in it names an image the updater will
 * pull, and the progress in it is written by another process and rendered on
 * an admin screen.
 *
 * So the tag is never taken from the request. The caller names a version, the
 * version is looked up in the feed, and the tag that reaches the file is the
 * feed's - the updater checks it again against its own copy of the feed before
 * it runs anything.
 *
 * The second rule is that there is one update at a time. Two pulls racing to
 * recreate the same container is not a state anybody has to recover from if it
 * is refused up front.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let dir: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "uxw-update-"));
    process.env.UXWVEND_UPDATE_DIR = dir;
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.UXWVEND_UPDATE_DIR;
});

const { readIntent, writeIntent, canStart } = await import("@/core/lib/core-update");

const release = { version: "0.3.0", tag: "0.3.0", publishedAt: "2026-09-01T00:00:00Z", notes: "", security: false, channel: "stable" as const, minVersion: null };

describe("asking for an update", () => {
    it("writes what the updater needs and nothing else", async () => {
        await writeIntent({ release, fromVersion: "0.2.1", requestedBy: "admin-1" });

        const intent = await readIntent();
        expect(intent).toMatchObject({
            tag: "0.3.0",
            toVersion: "0.3.0",
            fromVersion: "0.2.1",
            requestedBy: "admin-1",
            state: "requested",
        });
    });

    it("is readable by a process that was not running when it was written", async () => {
        await writeIntent({ release, fromVersion: "0.2.1", requestedBy: "admin-1" });
        // What the updater does: read the file off the shared volume.
        const raw = JSON.parse(fs.readFileSync(path.join(dir, "intent.json"), "utf8"));
        expect(raw.tag).toBe("0.3.0");
    });

    it("answers nothing when no update has ever been asked for", async () => {
        expect(await readIntent()).toBeNull();
    });

    it("does not trust what it reads back", async () => {
        // The updater writes progress into this file, so a corrupted or
        // half-written one must read as "no intent" rather than as a state
        // the screen will render.
        fs.writeFileSync(path.join(dir, "intent.json"), "{ not json");
        expect(await readIntent()).toBeNull();

        fs.writeFileSync(path.join(dir, "intent.json"), JSON.stringify({ tag: "0.3.0; rm -rf /", state: "running" }));
        expect(await readIntent()).toBeNull();
    });
});

describe("one at a time", () => {
    it("lets an update start when nothing is happening", async () => {
        expect(canStart(null)).toBe(true);
    });

    it("refuses while one is requested or running", async () => {
        await writeIntent({ release, fromVersion: "0.2.1", requestedBy: "admin-1" });
        expect(canStart(await readIntent())).toBe(false);

        await writeIntent({ release, fromVersion: "0.2.1", requestedBy: "admin-1", state: "running" });
        expect(canStart(await readIntent())).toBe(false);
    });

    it("lets the next one start once the last finished, either way", async () => {
        await writeIntent({ release, fromVersion: "0.2.1", requestedBy: "admin-1", state: "done" });
        expect(canStart(await readIntent())).toBe(true);

        await writeIntent({ release, fromVersion: "0.2.1", requestedBy: "admin-1", state: "failed" });
        expect(canStart(await readIntent())).toBe(true);
    });

    it("does not wedge for ever on an updater that died mid-run", async () => {
        // The updater writes a heartbeat; a run whose heartbeat stopped long
        // ago is not running, whatever the file says, or a crashed container
        // would leave the button disabled until somebody found the file.
        const old = new Date(Date.now() - 60 * 60_000).toISOString();
        await writeIntent({ release, fromVersion: "0.2.1", requestedBy: "admin-1", state: "running", heartbeatAt: old });
        expect(canStart(await readIntent())).toBe(true);
    });
});
