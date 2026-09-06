import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

/**
 * A setting nobody can set is not a setting.
 *
 * Four of them were read at runtime from rows in the settings table that
 * nothing ever wrote: no screen offered a field, no API accepted one, no
 * manifest declared a default. Each read fell back to a constant, so nothing
 * broke and nothing looked wrong - the values were simply fixed forever.
 *
 * One of them was not merely fixed. The wheel's spin cost decided whether a
 * paid spin existed at all, and its fallback was zero, so `paidSpin` was never
 * true: the balance check, the debit, the "not enough credits" answer and the
 * "spin again for N credits" button on the page were unreachable code in a
 * feature the module's own description advertised. The other three fixed the
 * price of a credit and the two creator-code defaults at whatever the author
 * had typed.
 *
 * All four are module settings now, which is the thing core already renders a
 * panel for, and this gate keeps the rest honest: a key read out of the
 * settings table has to be written somewhere too.
 */

const READS_A_SETTING =
    /(?:where:\s*\{\s*key:|getSetting\(|SETTING_KEY\s*=|ACTIVE_KEY\s*=)\s*"([a-z][a-z0-9_]{3,})"/g;

function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            // The rsynced copies of installed modules are the same files twice.
            if (full === path.join("src", "modules")) continue;
            if (entry.isDirectory()) walk(full);
            else if (/\.tsx?$/.test(entry.name)) out.push(full);
        }
    };
    for (const base of ["src", "module-sources"]) walk(base);
    return out;
}

const FILES = sourceFiles();
const SOURCE = new Map(FILES.map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")]));

/** A file that can put a value into the settings table, one way or another. */
const WRITES_A_SETTING = /setting\.(?:upsert|update|create|updateMany|createMany)/;

function canWrite(file: string, source: string): boolean {
    const p = file.split(path.sep).join("/");
    return WRITES_A_SETTING.test(source) || p.includes("/admin") || p.includes("(admin)");
}

describe("every settings key the code reads can be written", () => {
    const readers = new Map<string, Set<string>>();
    for (const [file, source] of SOURCE) {
        for (const match of source.matchAll(READS_A_SETTING)) {
            if (!readers.has(match[1])) readers.set(match[1], new Set());
            readers.get(match[1])!.add(file);
        }
    }

    it("finds the reads", () => {
        expect(readers.size).toBeGreaterThan(5);
    });

    it("something can write each one", () => {
        const stranded: string[] = [];
        for (const [key, where] of readers) {
            const settable = [...SOURCE].some(
                ([file, source]) => source.includes(key) && canWrite(file, source),
            );
            if (!settable) stranded.push(`${key} (read only in ${[...where].join(", ")})`);
        }
        expect(stranded.sort()).toEqual([]);
    });
});

describe("the wheel's paid spin can be switched on", () => {
    const manifest = JSON.parse(
        fs.readFileSync(path.join(ROOT, "module-sources/wheel/module.json"), "utf8"),
    );
    const spin = fs.readFileSync(
        path.join(ROOT, "module-sources/wheel/api/spin/route.ts"),
        "utf8",
    );

    it("declares the cost as a module setting", () => {
        const cost = manifest.settings?.find((s: { key: string }) => s.key === "spinCost");
        expect(cost).toBeTruthy();
        expect(cost.type).toBe("number");
        expect(cost.min).toBe(0);
    });

    it("reads it from there rather than from a row nothing writes", () => {
        expect(spin).toContain('moduleSettings<{ spinCost: number }>("wheel")');
        expect(spin).not.toMatch(/key:\s*"wheel_spin_cost"/);
    });
});

describe("the store's prices can be set", () => {
    const manifest = JSON.parse(
        fs.readFileSync(path.join(ROOT, "module-sources/store/module.json"), "utf8"),
    );
    const declared = new Map<string, { type: string; step?: number; min?: number }>(
        (manifest.settings ?? []).map((s: { key: string }) => [s.key, s]),
    );

    it.each(["creditsPricePerUnit", "creatorDefaultDiscount", "creatorDefaultCommission"])(
        "declares %s",
        (key) => {
            expect(declared.get(key)?.type).toBe("number");
        },
    );

    it("lets the price of a credit be a fraction of one", () => {
        // A number input steps by 1 unless told otherwise, so without this the
        // only prices a browser would accept are whole units of currency.
        const price = declared.get("creditsPricePerUnit")!;
        expect(price.step).toBeLessThan(1);
        expect(price.min).toBeLessThan(0.01);
    });

    it("requires a core that renders a step", () => {
        // At least the version that accepted `step`, not exactly it: the
        // module widens its floor whenever it starts using something newer,
        // and pinning the spelling made an unrelated bump fail here.
        const [, major, minor] = /\^(\d+)\.(\d+)\./.exec(manifest.coreVersion ?? "") ?? [];
        expect(Number(major)).toBe(1);
        expect(Number(minor)).toBeGreaterThanOrEqual(23);
    });
});

describe("core renders the step it now accepts", () => {
    it("the manifest schema takes one", () => {
        const schema = fs.readFileSync(path.join(ROOT, "src/core/lib/module-manifest-schema.ts"), "utf8");
        expect(schema).toContain("step: z.number().positive().optional()");
        expect(schema).toContain("min/max/step only apply to a number setting");
    });

    it("the settings panel passes it to the input", () => {
        const panel = fs.readFileSync(
            path.join(ROOT, "src/app/[locale]/(admin)/admin/modules/ModuleSettingsPanel.tsx"),
            "utf8",
        );
        expect(panel).toContain("step={setting.step}");
    });
});
