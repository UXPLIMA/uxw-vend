import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { iconNames } from "lucide-react/dynamic";
import { resolveIconName } from "@/core/lib/icon-names";

/**
 * An icon name is a string, and a string can be wrong.
 *
 * A module names its icons in `module.json`, a theme in `theme.json`, and
 * core writes a few of its own into the setup presets and the activity feed.
 * None of those is checked by the compiler: a name that lucide does not know
 * renders the fallback and writes a console warning, once per mount. Seven
 * manifests were doing exactly that - `Gamepad2` where lucide says
 * `gamepad-2` - and the only symptom anyone saw was a missing icon in the
 * marketplace and a wall of warnings in the panel's console.
 *
 * So the names are checked here instead, against lucide's own list, through
 * the same resolver the components use.
 */

const ROOT = join(__dirname, "..", "..");

interface Named {
    /** Where the name came from, for the failure message. */
    where: string;
    name: string;
}

function manifestIcons(): Named[] {
    const found: Named[] = [];
    const dir = join(ROOT, "module-sources");
    for (const id of readdirSync(dir)) {
        const file = join(dir, id, "module.json");
        if (!existsSync(file)) continue;
        const manifest = JSON.parse(readFileSync(file, "utf8"));
        const push = (name: unknown, where: string) => {
            if (typeof name === "string" && name !== "") found.push({ where: `${id}: ${where}`, name });
        };
        push(manifest.icon, "icon");
        for (const [i, entry] of (manifest.menu ?? []).entries()) push(entry.icon, `menu[${i}] ${entry.path}`);
        for (const [i, entry] of (manifest.navGroups ?? []).entries()) push(entry.icon, `navGroups[${i}] ${entry.id}`);
        for (const [i, entry] of (manifest.dashboardCards ?? []).entries()) push(entry.icon, `dashboardCards[${i}] ${entry.id}`);
    }
    return found;
}

function themeIcons(): Named[] {
    const found: Named[] = [];
    const dir = join(ROOT, "src", "themes");
    for (const id of readdirSync(dir)) {
        const file = join(dir, id, "theme.json");
        if (!existsSync(file)) continue;
        // Themes nest icons at several depths (admin routes, hero presets), so
        // rather than knowing the shape, take every "icon" key there is.
        for (const match of readFileSync(file, "utf8").matchAll(/"icon"\s*:\s*"([^"]+)"/g)) {
            found.push({ where: `theme ${id}`, name: match[1] });
        }
    }
    return found;
}

function coreIcons(): Named[] {
    const found: Named[] = [];
    for (const relative of ["src/core/lib/setup-presets.ts", "src/core/lib/activity-feed.ts"]) {
        for (const match of readFileSync(join(ROOT, relative), "utf8").matchAll(/\bicon:\s*"([^"]+)"/g)) {
            found.push({ where: relative, name: match[1] });
        }
    }
    return found;
}

describe("every icon name names an icon", () => {
    it("is looking at names at all", () => {
        // If a rename empties one of the three collectors, the suite below
        // passes by having nothing to check. This is the tripwire.
        expect(manifestIcons().length).toBeGreaterThan(60);
        expect(themeIcons().length).toBeGreaterThan(0);
        expect(coreIcons().length).toBeGreaterThan(0);
    });

    it("resolves every name a manifest, a theme or core ships", () => {
        const unknown = [...manifestIcons(), ...themeIcons(), ...coreIcons()]
            .filter((entry) => resolveIconName(entry.name, iconNames) === null)
            .map((entry) => `${entry.where} = ${entry.name}`);
        expect(unknown).toEqual([]);
    });

    it("accepts the spellings a manifest is allowed to use", () => {
        // Three ways of writing the same icon, all of which appear in the
        // manifests as shipped.
        expect(resolveIconName("ShoppingBag", iconNames)).toBe("shopping-bag");
        expect(resolveIconName("shopping-bag", iconNames)).toBe("shopping-bag");
        expect(resolveIconName("Gamepad2", iconNames)).toBe("gamepad-2");
        // And the digit rule that a blanket hyphenation would have broken.
        expect(resolveIconName("Grid2x2", iconNames)).toBe("grid-2x2");
    });

    it("says no rather than guessing", () => {
        expect(resolveIconName("NotAnIconAtAll", iconNames)).toBeNull();
        expect(resolveIconName("", iconNames)).toBeNull();
    });
});
