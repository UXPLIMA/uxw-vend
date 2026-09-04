import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { CANONICAL_SLOTS } from "@/core/lib/slot-registry";

const ROOT = process.cwd();

/**
 * The slot list and the slots core renders had drifted apart.
 *
 * `layout.beforeMain`, `layout.afterMain` and `head.extra` were documented as
 * the three generic injection points - the way a module adds a banner, a modal
 * or a head tag - and core rendered none of them. A module targeting any of the
 * three got silence, with nothing anywhere to say why. Meanwhile
 * `layout.overlay`, the slot the popups module actually ships against, was
 * rendered by core but absent from the list.
 *
 * Neither half could notice the other was wrong, so both are checked here.
 */
function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        if (!fs.existsSync(d)) return;
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) { if (entry.name !== "node_modules") walk(full); }
            else if (/\.tsx$/.test(entry.name)) out.push(full);
        }
    };
    walk(dir);
    return out;
}

/** Slot names core renders, read from the `<Slot>` / `<ServerSlot>` call sites. */
function renderedSlots(): Map<string, string> {
    const rendered = new Map<string, string>();
    for (const file of [...sourceFiles(path.join(ROOT, "src/app")), ...sourceFiles(path.join(ROOT, "src/core/components"))]) {
        // Slot.tsx's own doc comment shows example names it does not render.
        if (file.endsWith(path.join("core", "components", "Slot.tsx"))) continue;
        const source = fs.readFileSync(file, "utf8");
        for (const match of source.matchAll(/<(?:Server)?Slot\s+name="([^"]+)"/g)) {
            rendered.set(match[1], path.relative(ROOT, file));
        }
    }
    return rendered;
}

describe("canonical slots", () => {
    it("are every one of them actually rendered by core", () => {
        const rendered = renderedSlots();
        const missing = CANONICAL_SLOTS.filter((name) => !rendered.has(name));
        expect(missing).toEqual([]);
    });

    it("cover every slot core renders from the app shell", () => {
        const rendered = renderedSlots();
        const canonical = new Set<string>(CANONICAL_SLOTS);
        // A slot rendered inside a theme belongs to that theme, not to core.
        const undeclared = [...rendered.entries()]
            .filter(([, file]) => !file.includes(`src${path.sep}themes${path.sep}`))
            .filter(([name]) => !canonical.has(name))
            .map(([name, file]) => `${name} (${file})`);
        expect(undeclared).toEqual([]);
    });

    it("reaches head.extra without the module provider", () => {
        // <Slot> reads enabled modules from context, and that context only
        // exists inside <body>. head.extra renders above it.
        const layout = fs.readFileSync(path.join(ROOT, "src/app/[locale]/layout.tsx"), "utf8");
        const head = layout.slice(layout.indexOf("<head>"), layout.indexOf("</head>"));
        expect(head).toContain('<ServerSlot name="head.extra"');
    });
});

/**
 * The popups module contributed the same popup twice: `PopupModal` through
 * `layoutComponents`, which the root layout renders, and `PopupRenderer`
 * through `slotContents` on `layout.overlay`, which the root layout also
 * renders. Installing the module drew two stacked modals over every public
 * page, and because the two stored dismissal differently - one a session-wide
 * flag, the other a per-popup key - dismissing one did not dismiss the other.
 */
describe("module manifests", () => {
    const manifests = fs.readdirSync(path.join(ROOT, "module-sources"), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((name) => fs.existsSync(path.join(ROOT, "module-sources", name, "module.json")))
        .map((name) => ({
            name,
            manifest: JSON.parse(fs.readFileSync(path.join(ROOT, "module-sources", name, "module.json"), "utf8")) as {
                layoutComponents?: { component: string }[];
                slotContents?: { slot: string; component: string }[];
                slots?: { name: string; component: string }[];
            },
        }));

    it("were all found", () => {
        expect(manifests.length).toBeGreaterThan(50);
    });

    it("never mount one module in two places that both render", () => {
        const clashes: string[] = [];
        for (const { name, manifest } of manifests) {
            // Both of these render from the root layout on every public page.
            const viaLayout = (manifest.layoutComponents ?? []).length > 0;
            const overlay = [...(manifest.slotContents ?? []), ...(manifest.slots ?? [])]
                .some((sc) => ("slot" in sc ? sc.slot : sc.name) === "layout.overlay");
            if (viaLayout && overlay) {
                clashes.push(`${name}: layoutComponents and a layout.overlay contribution both render`);
            }
        }
        expect(clashes).toEqual([]);
    });

    it("target a slot core or another module renders, never a dead alias", () => {
        // These names were produced by generator aliases that fed a registry
        // no component ever imported.
        const DEAD = new Set(["layout.page", "navbar.right", "home.sidebar", "home.afterHero"]);
        const bad: string[] = [];
        for (const { name, manifest } of manifests) {
            for (const sc of [...(manifest.slotContents ?? []), ...(manifest.slots ?? [])]) {
                const slot = "slot" in sc ? sc.slot : (sc as { name: string }).name;
                if (DEAD.has(slot)) bad.push(`${name} -> ${slot}`);
            }
        }
        expect(bad).toEqual([]);
    });
});

/**
 * The generator used to write `src/core/generated/slot-registry.tsx` on every
 * build. Nothing imported it, so the canonical `slots:` manifest field it was
 * the only consumer of did nothing at all - and reading it was actively
 * misleading, since it listed contributions that were never going to render.
 */
describe("the generated slot registry", () => {
    it("is not written any more", () => {
        expect(fs.existsSync(path.join(ROOT, "src/core/generated/slot-registry.tsx"))).toBe(false);
    });

    it("is not what the generator emits the canonical slots field into", () => {
        const generator = fs.readFileSync(path.join(ROOT, "scripts/generate-registry.ts"), "utf8");
        expect(generator).not.toContain("slot-registry.tsx");
        // `slots:` has to land in the registry <Slot> reads.
        expect(generator).toContain("allSlotContents.push({");
    });
});
