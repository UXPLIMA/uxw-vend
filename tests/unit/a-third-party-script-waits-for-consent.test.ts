/**
 * Somebody else's script, and the answer nobody gave yet.
 *
 * A module that embeds a third party - analytics, a chat widget, a support
 * bubble - runs code from another company on every page, and that code sets
 * cookies in the visitor's browser before anyone has agreed to any. That is
 * the whole thing a consent banner exists to prevent, and it is undone by one
 * module loading its script without asking.
 *
 * The answer lives in one place a visitor's browser can read, and the modules
 * that need it cannot import each other: they are separate packages that a
 * site installs one at a time. So they all read the same key out of local
 * storage, and this holds the copies together.
 *
 * It also catches the module that forgets. Nothing else would: the script
 * loads, the page works, the widget appears, and the only symptom is a
 * regulator's letter.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCES = path.join(ROOT, "module-sources");

/** The one key. Written by the consent banner, read by everything embedded. */
const CONSENT_KEY = "cookie_consent";
/** The one answer that means yes. "true", "1" and "yes" are all wrong here. */
const ACCEPTED = "accepted";

interface Manifest {
    id: string;
    csp?: Record<string, string[]>;
}

/** Modules that declare an external script origin: they embed somebody else. */
function scriptEmbedders(): { id: string; dir: string; origins: string[] }[] {
    const found: { id: string; dir: string; origins: string[] }[] = [];
    for (const id of fs.readdirSync(SOURCES)) {
        const file = path.join(SOURCES, id, "module.json");
        if (!fs.existsSync(file)) continue;
        const manifest = JSON.parse(fs.readFileSync(file, "utf8")) as Manifest;
        const origins = manifest.csp?.["script-src"] ?? [];
        if (origins.length > 0) found.push({ id, dir: path.join(SOURCES, id), origins });
    }
    return found;
}

function sourceOf(dir: string): string {
    const parts: string[] = [];
    const walk = (at: string) => {
        for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
            const full = path.join(at, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.tsx?$/.test(entry.name)) parts.push(fs.readFileSync(full, "utf8"));
        }
    };
    walk(dir);
    return parts.join("\n");
}

const embedders = scriptEmbedders();

/**
 * A third party whose script is fetched but which sets nothing in the browser
 * on its own. Each entry says why waiting would be wrong rather than merely
 * unnecessary.
 */
const NO_COOKIES: Record<string, string> = {
    "cloudflare-turnstile":
        "The challenge that decides whether a sign-in is a person. Holding it back until somebody accepts cookies means the consent banner has to be dismissed before anyone can log in, and the widget is what protects the login form itself.",
};

describe("a module that embeds somebody else's script", () => {
    it("finds the modules that do", () => {
        // A guard on the test: a broken scan would pass by finding none.
        expect(embedders.length).toBeGreaterThanOrEqual(2);
    });

    it.each(embedders.map((e) => [e.id, e] as const))("%s waits until the visitor has accepted", (_id, embedder) => {
        if (NO_COOKIES[embedder.id]) return;
        const source = sourceOf(embedder.dir);
        expect(source, `${embedder.id} loads a third-party script without reading consent`).toContain(CONSENT_KEY);
        expect(source, `${embedder.id} reads consent but not the answer that means yes`).toContain(ACCEPTED);
    });

    it("declares every origin it loads from, so the policy allows it", () => {
        const wrong: string[] = [];
        for (const embedder of embedders) {
            const source = sourceOf(embedder.dir);
            for (const match of source.matchAll(/https:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi)) {
                const origin = match[0];
                // Only the ones a script is actually fetched from.
                if (!/embed|script|tag|cdn|js/i.test(source.slice(Math.max(0, match.index! - 120), match.index!))) continue;
                if (!embedder.origins.some((allowed) => origin.startsWith(allowed))) {
                    wrong.push(`${embedder.id}: ${origin}`);
                }
            }
        }
        expect(wrong).toEqual([]);
    });
});
