/**
 * Every module hook was a silent no-op on a cold server.
 *
 * Measured against a production build on 2026-09-09. A freshly started server
 * logged "Registered 56 module hook listeners" and then answered
 * `/api/v1/store/payment-providers` with an empty list, in three milliseconds,
 * without touching the database - while a gateway sat installed, enabled and
 * configured. Asking the introspection endpoint (which calls `bootstrapHooks`
 * itself before it reads anything) and repeating the request returned the
 * gateway. Rendering a page in between changed nothing.
 *
 * `instrumentation.ts` runs in its own module graph, so the registry it fills
 * is not the one a route handler reads. In an unbootstrapped graph
 * `applyFiltersAsync` finds no listeners and returns its input - no error, no
 * log line. Every gateway went unoffered, no order granted a license key, and
 * the sign-in challenge filter never ran, all without a single symptom in a
 * log.
 *
 * The bus cannot fix this itself: `hooks.ts` is re-exported through the
 * isomorphic SDK and is deliberately free of imports, so it cannot reach the
 * bootstrap that needs the database. What can be pinned is the other side -
 * anything that dispatches a hook to module listeners bootstraps the bus
 * first, and the two dispatchers that stand in front of every module page and
 * every module API do it once for all of them.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

/** Dispatching to whatever listeners the running graph happens to hold. */
const DISPATCH = /\b(applyFiltersAsync|doActionAsync|applyFilters|doAction)\s*\(/;
/** Making sure that graph holds the module listeners before asking. */
const ENSURES = /\b(bootstrapHooks|ensureHooks)\s*\(/;

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== "node_modules" && entry.name !== "generated") walk(full, out);
        } else if (/\.tsx?$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

const appFiles = walk(path.join(ROOT, "src", "app"));
const read = (file: string) => fs.readFileSync(file, "utf8");

/**
 * The two files every module page and every module API is served through.
 * They carry the cost once so nothing a module ships has to remember.
 */
const MODULE_ENTRY_POINTS = [
    "src/app/api/v1/[...path]/route.ts",
    "src/app/[locale]/[...slug]/page.tsx",
    "src/app/[locale]/(admin)/admin/[...slug]/page.tsx",
];

describe("the dispatchers in front of every module", () => {
    it.each(MODULE_ENTRY_POINTS)("%s bootstraps the bus before serving", (file) => {
        const full = path.join(ROOT, file);
        expect(fs.existsSync(full), `${file} is missing`).toBe(true);
        expect(ENSURES.test(read(full)), `${file} serves module code without bootstrapping the hook bus`).toBe(true);
    });
});

describe("anything else that dispatches a hook", () => {
    it("bootstraps the bus in its own graph first", () => {
        // Only a direct dispatch. A route that reaches one through the logger
        // is not asking a module a question and is not what broke.
        const offenders = appFiles
            .filter((file) => DISPATCH.test(read(file)))
            .filter((file) => !ENSURES.test(read(file)))
            .map((file) => path.relative(ROOT, file));
        expect(offenders).toEqual([]);
    });

    it("has files to check, so a broken walk cannot pass by finding none", () => {
        expect(appFiles.filter((file) => DISPATCH.test(read(file))).length).toBeGreaterThan(5);
    });
});

describe("the bootstrap itself", () => {
    it("is cheap to call again, because every request will", () => {
        const source = read(path.join(ROOT, "src", "core", "lib", "hooks-bootstrap.ts"));
        // The guard that makes calling it per request a comparison rather than
        // fifty-six dynamic imports.
        expect(source).toMatch(/isBootstrapped\(\)/);
    });

    it("stays out of the isomorphic bus, which cannot reach a database", () => {
        const bus = read(path.join(ROOT, "src", "core", "lib", "hooks.ts"));
        expect(bus).not.toMatch(/from\s+["'].*hooks-bootstrap/);
        expect(bus).not.toMatch(/import\(\s*["'].*hooks-bootstrap/);
    });
});
