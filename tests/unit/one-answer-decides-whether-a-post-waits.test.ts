import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Four modules decide whether a person's post is published or queued, and
 * each carries its own copy of the decision.
 *
 * `getModerationMode` reads the `moderation` setting and answers "manual"
 * only when the stored value says so, "auto" otherwise. The forum has it
 * twice, once for topics and once for posts; the blog has it for comments;
 * suggestions has it for suggestions. Measured on 2026-09-07, all four are
 * byte for byte the same after whitespace.
 *
 * That is worth keeping true. The same shape drifted once already elsewhere
 * in this product: the impersonation rules were written in the endpoint and
 * enforced in the token callback, and the callback had three of the six. Here
 * the drift would decide whether something a stranger wrote appears on the
 * site immediately.
 *
 * Consolidating them into `@/core/sdk/server` is the better end state and is
 * not this file's business: a module reaches core only through the SDK, and
 * adding a name to it is a minor CORE_API_VERSION bump, which changes what
 * every module's compatibility range means. That is a decision, not a tidy-up.
 * Until it is made, the four stay one answer.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

const COPIES = [
    "module-sources/forum/api/topics/route.ts",
    "module-sources/forum/api/topics/[id]/route.ts",
    "module-sources/blog/api/comments/route.ts",
    "module-sources/suggestions/api/route.ts",
];

/** The body of `getModerationMode`, brace matched, whitespace flattened. */
function decisionIn(file: string): string | null {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    const start = source.indexOf("async function getModerationMode");
    if (start === -1) return null;
    let depth = 0;
    let i = source.indexOf("{", start);
    for (; i < source.length; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}" && --depth === 0) break;
    }
    return source.slice(start, i + 1).replace(/\s+/g, " ").trim();
}

describe("whether a post waits for a moderator", () => {
    it("is decided in every module that publishes what a stranger wrote", () => {
        for (const file of COPIES) {
            expect(decisionIn(file), `${file} no longer carries the decision`).toBeTruthy();
        }
    });

    it("is the same answer in all of them", () => {
        const bodies = COPIES.map((file) => [file, decisionIn(file)] as const);
        const [, first] = bodies[0];
        const different = bodies.filter(([, body]) => body !== first).map(([file]) => file);

        expect(
            different,
            `These answer differently from ${COPIES[0]}, so the same setting would\n` +
            `hold a forum post and publish a blog comment:\n${different.join("\n")}`,
        ).toEqual([]);
    });

    it("reads the setting the moderation screen writes", () => {
        const screen = fs.readFileSync(
            path.join(ROOT, "src/app/[locale]/(admin)/admin/settings/moderation/page.tsx"),
            "utf8",
        );
        // The screen sends { moderation: { <settingKey>: "auto" | "manual" } }.
        expect(screen).toMatch(/moderation:\s*config/);
        expect(decisionIn(COPIES[0])).toContain('key: "moderation"');
    });
});
