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

/** Whether a declared version is at least the one a feature arrived in. */
function atLeast(a: number[], b: readonly number[]): boolean {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] > b[i];
    }
    return true;
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

describe("the wheel's price can be set", () => {
    const wheelsScreen = fs.readFileSync(
        path.join(ROOT, "module-sources/wheel/pages/admin/wheels/page.tsx"),
        "utf8",
    );
    const spin = fs.readFileSync(
        path.join(ROOT, "module-sources/wheel/api/spin/route.ts"),
        "utf8",
    );
    const schema = fs.readFileSync(
        path.join(ROOT, "module-sources/wheel/schema.prisma"),
        "utf8",
    );

    /*
     * The price used to be a `wheel_spin_cost` row in the settings table that
     * no screen wrote and no manifest declared a default for, so it was always
     * absent, so the cost was always zero, so the whole paid half of the route
     * - the balance check, the debit, the "not enough credits" answer and the
     * button that offered another turn - could not be reached by any operator.
     *
     * It became a module setting, and then a column: a site runs several
     * wheels and each one has its own price, which a module-wide number cannot
     * express. What has to stay true is the same thing either way - the number
     * the endpoint charges is a number an operator can change.
     */

    it("keeps the price on the wheel, where a second wheel can have a different one", () => {
        expect(schema).toMatch(/model Wheel \{[\s\S]*?cost\s+Int/);
    });

    it("offers it on the screen that edits a wheel", () => {
        expect(wheelsScreen).toContain('key: "cost"');
        expect(wheelsScreen).toContain('type: "number"');
    });

    it("charges what the wheel says, not a number nothing writes", () => {
        expect(spin).toContain("wheel.cost");
        expect(spin).not.toMatch(/key:\s*"wheel_spin_cost"/);
        expect(spin).not.toContain('moduleSettings<{ spinCost: number }>("wheel")');
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
        //
        // Compared as a whole version rather than one field at a time. It used
        // to read the major and the minor separately and assert the major was
        // 1, which turned the first major bump the product ever had into a
        // failure in a test about a number input.
        const asked = /\^(\d+)\.(\d+)\.(\d+)/.exec(manifest.coreVersion ?? "");
        expect(asked, `declares ${manifest.coreVersion}`).toBeTruthy();
        expect(atLeast(asked!.slice(1, 4).map(Number), [1, 23, 0])).toBe(true);
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
