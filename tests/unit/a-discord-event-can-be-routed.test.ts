import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const MODULE = path.join(process.cwd(), "module-sources/discord-integration");
const read = (p: string) => fs.readFileSync(path.join(MODULE, p), "utf8");

/**
 * Every event the module posts can be pointed at a channel.
 *
 * `sendDiscordWebhook(event)` looks up the setting `discord_webhook_${event}`
 * and falls back to `discord_webhook_general`. The settings screen writes those
 * rows from a hand-kept list, and the listeners name their events by hand too,
 * so the only thing that held the two together was that someone had written
 * both. A blog article was posted by a listener that no row on the screen
 * corresponded to: every site with a general webhook got articles in whatever
 * channel it pointed at, and no site could send them anywhere else.
 *
 * The fallback is what made it quiet. Nothing errored, nothing was missing on
 * screen, and the only way to notice was to wonder why one kind of message
 * never went where it was told.
 */

const listeners = fs
    .readdirSync(path.join(MODULE, "listeners"))
    .filter((f) => f.endsWith(".ts"));

/** The event names the module actually posts under. */
function postedEvents(): Set<string> {
    const events = new Set<string>();
    for (const file of listeners) {
        const source = read(path.join("listeners", file));
        for (const match of source.matchAll(/sendDiscordWebhook\(\s*"([a-z0-9_]+)"/g)) {
            events.add(match[1]);
        }
    }
    return events;
}

/** The settings rows the admin screen offers, minus the fallback. */
function offeredEvents(): Set<string> {
    const screen = read("pages/admin/page.tsx");
    const events = new Set<string>();
    for (const match of screen.matchAll(/key:\s*"discord_webhook_([a-z0-9_]+)"/g)) {
        if (match[1] !== "general") events.add(match[1]);
    }
    return events;
}

describe("the settings screen and the listeners name the same events", () => {
    const posted = postedEvents();
    const offered = offeredEvents();

    it("finds both lists", () => {
        expect(listeners.length).toBeGreaterThan(4);
        expect(posted.size).toBeGreaterThan(4);
        expect(offered.size).toBe(posted.size);
    });

    it("every event the module posts has somewhere to be sent", () => {
        expect([...posted].filter((e) => !offered.has(e)).sort()).toEqual([]);
    });

    it("no row on the screen routes an event nothing posts", () => {
        expect([...offered].filter((e) => !posted.has(e)).sort()).toEqual([]);
    });

    it("keeps the general fallback, which is what hid the gap", () => {
        expect(read("pages/admin/page.tsx")).toContain('key: "discord_webhook_general"');
        expect(read("lib/discord.ts")).toContain('const generalKey = "discord_webhook_general"');
    });
});

describe("every row on the screen is labelled in both languages", () => {
    const manifest = JSON.parse(read("module.json"));
    const screen = read("pages/admin/page.tsx");
    const keys = [...screen.matchAll(/(?:labelKey|descKey):\s*"([a-z0-9_]+)"/gi)].map((m) => m[1]);

    it("has some to check", () => {
        expect(keys.length).toBeGreaterThan(10);
    });

    it.each(["en", "tr"])("%s", (locale) => {
        const namespace = manifest.translations[locale].discordIntegration;
        expect(keys.filter((k) => !namespace[k])).toEqual([]);
    });
});
