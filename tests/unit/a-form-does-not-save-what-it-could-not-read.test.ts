import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { readJson, ReadFailed } from "@/core/lib/read-json";

/**
 * A settings screen that could not read cannot be allowed to write.
 *
 * `fetch(...).then((r) => r.json())` resolves for a 500 as happily as for a
 * 200. Five screens read the site settings that way, took `data.settings ||
 * {}` from whatever came back, filled their form with per-field defaults and
 * called it loaded. The catch below them said `setLoading(false)` and nothing
 * else. So a failed read rendered a complete, plausible, editable form - and
 * the save button under it wrote the defaults over the real settings: a lost
 * custom stylesheet, a site renamed to "uxwVend" with its social links
 * emptied, a navbar replaced by the module registry's own defaults.
 *
 * The read lives in one hook now for the screens that read nothing else. It
 * calls `apply` only on a response that actually succeeded, and every screen
 * refuses to render its form - and so its save button - while `failed` is
 * true. A screen that reads more than one endpoint keeps its own state and
 * owes the same two things: a read that cannot resolve on a failure, and a
 * failure the reader can see and retry.
 */

const ROOT = path.resolve(__dirname, "../..");

const SEARCH = [
    "src/app/[locale]/(admin)",
    "src/core/components/admin",
    // A module's settings screen writes to the same endpoint and had the same
    // hole, so the rule is the same one. `useSettingsLoad` is on the SDK for
    // exactly this reason: a rule a module cannot follow is not a rule.
    ...moduleAdminRoots(),
];

function moduleAdminRoots(): string[] {
    const sources = path.join(ROOT, "module-sources");
    if (!fs.existsSync(sources)) return [];
    return fs.readdirSync(sources, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join("module-sources", e.name, "pages/admin"))
        .filter((p) => fs.existsSync(path.join(ROOT, p)));
}

function sources(dir: string, into: string[] = []): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return into;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) sources(full, into);
        else if (entry.name.endsWith(".tsx")) into.push(full);
    }
    return into;
}

/** A file that writes the site settings back. */
function writesSettings(source: string): boolean {
    return /fetch\(\s*["'`]\/api\/v1\/settings["'`]\s*,\s*\{[\s\S]{0,200}?method:\s*["'`](?:PATCH|PUT|POST)["'`]/.test(source);
}

/** A file that reads them: the same path, with no second argument. */
function readsSettings(source: string): boolean {
    return /fetch\(\s*["'`]\/api\/v1\/settings["'`]\s*\)/.test(source);
}

describe("a settings screen", () => {
    const files = SEARCH.flatMap((d) => sources(path.join(ROOT, d)));

    it("finds the screens", () => {
        expect(files.length).toBeGreaterThan(100);
        expect(files.filter((f) => writesSettings(fs.readFileSync(f, "utf8"))).length).toBeGreaterThan(3);
    });

    it("cannot mistake a failed read for an empty one", () => {
        // Either the shared hook, or an explicit check on the response. What
        // is not allowed is `.then((r) => r.json())` on the settings read,
        // which resolves for a 500 with the error body as the answer.
        const offenders: string[] = [];
        for (const file of files) {
            const source = fs.readFileSync(file, "utf8");
            if (!readsSettings(source) || !writesSettings(source)) continue;
            const guarded = source.includes("useSettingsLoad") || /\br\.ok\b|\bres\.ok\b|\bresponse\.ok\b/.test(source);
            if (!guarded) offenders.push(path.relative(ROOT, file));
        }
        expect(offenders).toEqual([]);
    });

    it("shows the failure rather than offering the form over it", () => {
        const offenders: string[] = [];
        for (const file of files) {
            const source = fs.readFileSync(file, "utf8");
            if (!readsSettings(source) || !writesSettings(source)) continue;
            // The failure has to reach the render, and the reader has to be
            // given a way back: these screens load once on mount.
            if (!/\b(?:failed|loadFailed)\b/.test(source) || !source.includes("LoadFailed")) {
                offenders.push(path.relative(ROOT, file));
            }
        }
        expect(offenders).toEqual([]);
    });
});

describe("the hook", () => {
    it("is reachable by a module", () => {
        const sdk = fs.readFileSync(path.join(ROOT, "src/core/sdk/admin.ts"), "utf8");
        expect(sdk).toContain("useSettingsLoad");
    });

    const source = fs.readFileSync(path.join(ROOT, "src/core/hooks/useSettingsLoad.ts"), "utf8");

    it("goes through readJson rather than json()", () => {
        expect(source).toContain("readJson");
        expect(source).not.toMatch(/\.then\(\(r\) => r\.json\(\)\)/);
    });

    it("applies nothing when the read failed", () => {
        const failure = source.slice(source.lastIndexOf(".catch("));
        expect(failure).toContain("setFailed(true)");
        expect(failure).not.toContain("applyRef.current");
    });
});

describe("readJson", () => {
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

    it("returns the parsed body of a response that succeeded", async () => {
        await expect(readJson(ok({ settings: { site_name: "x" } }))).resolves.toEqual({
            settings: { site_name: "x" },
        });
    });

    it("rejects a response that failed, whatever its body parses to", async () => {
        // This is the whole point: the error body of a 500 is valid JSON, and
        // `data.settings || {}` turns it into an empty settings object.
        const response = new Response(JSON.stringify({ error: "boom" }), { status: 500 });
        await expect(readJson(response)).rejects.toBeInstanceOf(ReadFailed);
    });

    it("carries the status, so a caller can tell 401 from 500", async () => {
        const response = new Response("{}", { status: 401 });
        await expect(readJson(response)).rejects.toMatchObject({ status: 401 });
    });
});
