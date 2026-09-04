import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Modules keep their configuration in the shared `Setting` table, one row per
 * key, alongside core's. `Setting.module` says who a row belongs to and is
 * indexed, but nothing deleted by it: uninstall removed the module's files,
 * its translations and its cron rows, and left its settings behind forever.
 *
 * That is not the same call as preserving module-owned tables. Those hold
 * what the admin built - products, articles, tickets - and a reinstall should
 * find them. A module's settings are credentials and endpoints for a service
 * the operator has just decided to stop using: uninstalling Cloudflare R2 left
 * its access key and secret in the database, and took away the only screen
 * that could have cleared them.
 *
 * Cleanup only works if the rows can be found, and two of the six modules that
 * write settings never set the column, so their rows defaulted to "core" and
 * were indistinguishable from the platform's own. Both halves are pinned here.
 */

const ROOT = path.resolve(__dirname, "../..");
const SOURCES = path.join(ROOT, "module-sources");

/** The argument source of each `prisma.setting.upsert(...)` style call. */
function settingWriteCalls(body: string): string[] {
    const out: string[] = [];
    const re = /prisma\.setting\.(?:upsert|create|createMany)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
        let depth = 0;
        let i = m.index + m[0].length - 1;
        const start = i;
        for (; i < body.length; i++) {
            const c = body[i];
            if (c === "(" || c === "{" || c === "[") depth++;
            else if (c === ")" || c === "}" || c === "]") {
                depth -= 1;
                if (depth === 0) break;
            }
        }
        out.push(body.slice(start, i + 1));
    }
    return out;
}

function moduleFiles(dir: string): string[] {
    const out: string[] = [];
    (function walk(d: string) {
        if (!fs.existsSync(d)) return;
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules") continue;
                walk(full);
            } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
                out.push(full);
            }
        }
    })(dir);
    return out;
}

const MODULES = fs
    .readdirSync(SOURCES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ id: e.name, dir: path.join(SOURCES, e.name) }));

describe("settings a module writes", () => {
    it("reads the module sources", () => {
        expect(MODULES.length).toBeGreaterThan(50);
    });

    it("finds the modules that write settings at all", () => {
        const writers = MODULES.filter(({ dir }) =>
            moduleFiles(dir).some((f) => settingWriteCalls(fs.readFileSync(f, "utf8")).length > 0),
        );
        // If this ever drops to zero the check below passes for the wrong reason.
        expect(writers.length).toBeGreaterThan(0);
    });

    it("always say which module owns the row", () => {
        const untagged: string[] = [];
        for (const { id, dir } of MODULES) {
            for (const file of moduleFiles(dir)) {
                const body = fs.readFileSync(file, "utf8");
                for (const call of settingWriteCalls(body)) {
                    // `update` needs no owner: the row already has one.
                    if (!/\bcreate\s*:/.test(call) && !/\bdata\s*:/.test(call)) continue;
                    if (/\bmodule\s*:/.test(call)) continue;
                    untagged.push(`${id}: ${path.relative(dir, file)}`);
                }
            }
        }
        expect(untagged).toEqual([]);
    });
});

describe("uninstall", () => {
    const route = fs.readFileSync(
        path.join(ROOT, "src/app/api/v1/modules/[id]/route.ts"),
        "utf8",
    );

    it("deletes the module's settings", () => {
        expect(route).toMatch(/prisma\.setting[\s\S]{0,80}deleteMany\(\{ where: \{ module: moduleId \} \}\)/);
    });

    it("drops the cached public payload after doing so", () => {
        // A deleted row that stays in the 60s public-settings cache is a
        // setting the site still serves after the module is gone.
        const at = route.indexOf("prisma.setting");
        expect(at).toBeGreaterThan(-1);
        expect(route.slice(at, at + 400)).toContain('invalidate("public-settings")');
    });

    it("still clears the things it already cleared", () => {
        expect(route).toContain("removeModuleTranslations(");
        expect(route).toMatch(/cronRun[\s\S]{0,120}deleteMany/);
        expect(route).toMatch(/moduleConfig\.deleteMany\(\{ where: \{ id: moduleId \} \}\)/);
    });
});
