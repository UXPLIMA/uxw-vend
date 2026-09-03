import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The first-run wizard runs behind the setup gate in src/proxy.ts, which
 * answers every path outside /api/setup with 503 "Setup required" until a user
 * exists. A wizard fetch aimed anywhere else therefore cannot succeed on the
 * one install it exists to serve, and it fails silently: the steps catch the
 * error and render an empty state, so the wizard looks like it simply has
 * nothing to offer.
 *
 * That shipped twice. The theme step fetched a route that did not exist and
 * rendered an empty grid; the module step fetched
 * /api/v1/modules/marketplace and always said "No modules available yet". Both
 * are the same mistake, so this asserts the rule rather than the two cases.
 */

const WIZARD_DIR = path.join(process.cwd(), "src", "app", "[locale]", "(setup)");
const SETUP_API_DIR = path.join(process.cwd(), "src", "app", "api", "setup");

function tsxFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return tsxFiles(full);
        return /\.tsx?$/.test(e.name) ? [full] : [];
    });
}

/** Every absolute API path the wizard fetches, with the file it came from. */
function wizardFetches(): Array<{ file: string; url: string }> {
    const out: Array<{ file: string; url: string }> = [];
    for (const file of tsxFiles(WIZARD_DIR)) {
        const src = fs.readFileSync(file, "utf-8");
        for (const m of src.matchAll(/fetch\(\s*["'`](\/[^"'`?]+)/g)) {
            out.push({ file: path.relative(process.cwd(), file), url: m[1] });
        }
    }
    return out;
}

describe("setup wizard endpoints", () => {
    it("fetches something (guards against the scan silently matching nothing)", () => {
        expect(wizardFetches().length).toBeGreaterThan(0);
    });

    it("only fetches paths the setup gate lets through", () => {
        const offenders = wizardFetches().filter((f) => !f.url.startsWith("/api/setup"));
        expect(
            offenders.map((o) => `${o.file} fetches ${o.url}`),
            "the setup gate 503s every API path outside /api/setup while the wizard is running",
        ).toEqual([]);
    });

    it("has a route backing every path it fetches", () => {
        for (const { file, url } of wizardFetches()) {
            const rest = url.replace(/^\/api\/setup/, "");
            const routeFile = path.join(SETUP_API_DIR, rest, "route.ts");
            expect(fs.existsSync(routeFile), `${file} fetches ${url} but ${path.relative(process.cwd(), routeFile)} does not exist`).toBe(true);
        }
    });
});

/**
 * theme.json declares suggestedModules as objects. The wizard's ThemeOption
 * typed it as string[], so the card rendered "Suggests: [object Object]".
 * TypeScript could not catch it: the fetch response is cast, not validated.
 */
describe("theme suggestedModules shape", () => {
    const themesDir = path.join(process.cwd(), "src", "themes");

    it("is an array of objects carrying an id, in every shipped theme", () => {
        const themes = fs.readdirSync(themesDir, { withFileTypes: true }).filter((e) => e.isDirectory());
        expect(themes.length).toBeGreaterThan(0);

        for (const theme of themes) {
            const manifest = path.join(themesDir, theme.name, "theme.json");
            if (!fs.existsSync(manifest)) continue;
            const suggested = JSON.parse(fs.readFileSync(manifest, "utf-8")).suggestedModules;
            if (suggested === undefined) continue;

            expect(Array.isArray(suggested), `${theme.name}: suggestedModules must be an array`).toBe(true);
            for (const entry of suggested) {
                expect(typeof entry, `${theme.name}: each suggestion is an object, not a bare id`).toBe("object");
                expect(typeof entry.id).toBe("string");
            }
        }
    });
});
