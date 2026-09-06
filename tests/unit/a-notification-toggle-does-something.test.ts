/**
 * Every row in the notification preferences grid is a switch on something.
 *
 * The grid in /profile was decorative in four separate ways at once, and each
 * one was invisible from the others.
 *
 * The columns it renders are `["email", "inapp"]`, and a row shows a toggle
 * only where `channels.includes(column)`. All five modules declared `"site"`.
 * So the In-app column was a dash on every row, and announcements, which
 * declared only `"site"`, had a row with no toggles in it at all.
 *
 * Two of the five named an event nothing fires. forum declared
 * `forum.topic.replied` and emits `forum.post.created`; store declared
 * `store.order.status.changed` and emits `store.order.completed`. A person
 * could mute either one forever without changing anything.
 *
 * And `shouldNotify`, the check that reads a saved preference back, was
 * called by nobody. Its own doc comment described a caller - "the in-app or
 * email sender calls shouldNotify before actually delivering" - that did not
 * exist, and it was not on the SDK, so no module could have been that caller
 * even by trying.
 *
 * Four separate pieces, each plausible on its own, adding up to a settings
 * screen that wrote rows nothing would ever read.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { notificationTypeKey } from "@/core/components/profile/NotificationPrefsTab";

const MODULES = "module-sources";

/** The columns NotificationPrefsTab renders. A channel outside these is a dash. */
const RENDERED_CHANNELS = new Set(["email", "inapp"]);

interface Manifest {
    notificationTypes?: { eventType: string; label: string; channels?: string[] }[];
    hooksEmitted?: (string | { name?: string; hook?: string })[];
    translations?: Record<string, Record<string, Record<string, string>>>;
}

const manifests = new Map<string, Manifest>();
for (const id of fs.readdirSync(MODULES)) {
    const file = path.join(MODULES, id, "module.json");
    if (fs.existsSync(file)) manifests.set(id, JSON.parse(fs.readFileSync(file, "utf8")));
}

const fired = new Set<string>();
for (const manifest of manifests.values()) {
    for (const hook of manifest.hooksEmitted ?? []) {
        const name = typeof hook === "string" ? hook : hook.name ?? hook.hook;
        if (name) fired.add(name);
    }
}

const declared = [...manifests].flatMap(([id, m]) =>
    (m.notificationTypes ?? []).map((type) => ({ id, type })),
);

describe("a notification toggle does something", () => {
    it("has rows to check", () => {
        expect(declared.length).toBeGreaterThan(5);
    });

    it("names an event some module actually fires", () => {
        const phantom = declared
            .filter(({ type }) => !fired.has(type.eventType))
            .map(({ id, type }) => `${id}: ${type.eventType}`);
        expect(phantom).toEqual([]);
    });

    it("offers only channels the grid draws a switch for", () => {
        const invisible = declared
            .flatMap(({ id, type }) =>
                (type.channels ?? []).filter((c) => !RENDERED_CHANNELS.has(c)).map((c) => `${id}: ${c}`))
        expect(invisible).toEqual([]);
    });

    it("leaves no row with nothing to toggle", () => {
        const mute = declared
            .filter(({ type }) => (type.channels ?? []).length === 0)
            .map(({ id, type }) => `${id}: ${type.eventType}`);
        expect(mute).toEqual([]);
    });

    it("says each row in both languages", () => {
        const missing: string[] = [];
        for (const { id, type } of declared) {
            const key = notificationTypeKey(type.eventType);
            for (const locale of ["en", "tr"]) {
                if (!manifests.get(id)?.translations?.[locale]?.profile?.[key]) {
                    missing.push(`${id}: ${locale}.profile.${key}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });

    it("is read back by whatever sends the thing it mutes", () => {
        // A preference nothing consults is a switch wired to nothing.
        const listeners = path.join(MODULES, "in-app-notifications", "listeners");
        const files = fs.readdirSync(listeners);
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            const source = fs.readFileSync(path.join(listeners, file), "utf8");
            expect(source, `${file} sends without asking`).toContain("shouldNotify(");
        }
    });
});
