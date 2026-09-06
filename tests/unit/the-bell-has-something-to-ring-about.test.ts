/**
 * A module that shows a feed has something that fills it.
 *
 * in-app-notifications shipped a bell, a notifications page, a Notification
 * table, a GET that reads it and a PATCH that marks rows read - and nothing,
 * anywhere, that ever wrote a row. Its `createNotification` helper was
 * exported and called by nobody, it declared no hook listeners, and its API
 * had no POST. Modules do not import each other, so a hook listener is the
 * only way an event elsewhere could have reached it. Installed, the bell was
 * empty by construction, for good.
 *
 * What makes that possible to ship is that every piece looks finished on its
 * own. So this checks the join: a module whose schema declares a table it
 * reads for a person has to have some path that creates a row in it.
 *
 * The listeners are held to addressing someone in particular. A hook payload
 * that carries no user id cannot produce a personal notification, and a
 * listener that invents a recipient - the site owner, the first admin - is
 * how a bell fills with things that are not the reader's business.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MODULE = path.join("module-sources", "in-app-notifications");

interface Manifest {
    hookListeners?: { hook: string; type: string; handler: string }[];
    translations?: Record<string, Record<string, Record<string, string>>>;
}

const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(MODULE, "module.json"), "utf8"));
const listeners = manifest.hookListeners ?? [];

describe("the bell has something to ring about", () => {
    it("listens for events that fill it", () => {
        expect(listeners.length).toBeGreaterThan(0);
    });

    it("declares a handler file that exists and creates a notification", () => {
        for (const listener of listeners) {
            const handler = path.join(MODULE, listener.handler);
            expect(fs.existsSync(handler), `${listener.hook} -> ${listener.handler}`).toBe(true);
            expect(fs.readFileSync(handler, "utf8")).toContain("createNotification");
        }
    });

    it("addresses a person the payload names, and gives up when it names none", () => {
        for (const listener of listeners) {
            const source = fs.readFileSync(path.join(MODULE, listener.handler), "utf8");
            // The recipient is read off the payload, never chosen by the module.
            const addressed = /userId:\s*payload\.\w+/.test(source);
            expect(addressed, `${listener.hook} must address payload's own user`).toBe(true);
            // And a payload with nobody in it writes nothing.
            expect(/if\s*\(!payload\??\.\w+\)\s*return;|if\s*\(!payload\?\.\w+\s*\|\|/.test(source),
                `${listener.hook} must return when the payload names nobody`).toBe(true);
        }
    });

    it("hooks every hook it listens for onto one another module actually fires", () => {
        const fired = new Set<string>();
        for (const dir of fs.readdirSync("module-sources")) {
            const file = path.join("module-sources", dir, "module.json");
            if (!fs.existsSync(file)) continue;
            for (const hook of JSON.parse(fs.readFileSync(file, "utf8")).hooksEmitted ?? []) {
                fired.add(typeof hook === "string" ? hook : hook.name ?? hook.hook);
            }
        }
        for (const listener of listeners) {
            expect(fired.has(listener.hook), `nothing fires ${listener.hook}`).toBe(true);
        }
    });

    it("says every key its listeners write, in both languages", () => {
        const used = new Set<string>();
        for (const listener of listeners) {
            const source = fs.readFileSync(path.join(MODULE, listener.handler), "utf8");
            for (const key of source.matchAll(/"(notif_\w+)"/g)) used.add(key[1]);
        }
        expect(used.size).toBeGreaterThan(0);
        for (const locale of ["en", "tr"]) {
            const strings = manifest.translations?.[locale]?.inAppNotifications ?? {};
            for (const key of used) {
                expect(strings[key], `${locale} is missing ${key}`).toBeTruthy();
            }
        }
    });
});
