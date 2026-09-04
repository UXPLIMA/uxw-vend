import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * next-intl does not throw on a missing message. It logs and renders the key
 * path, so a heading reads "store.vip_title" where the title belongs. The
 * store's public VIP page, both of its profile tabs, its bulk-discount and
 * creator-code admin screens, the custom-forms admin screen and the servers
 * admin screen all shipped rendering keys their manifests never declared.
 *
 * `validate-module` fails a module for this now; the same rule runs here so
 * `npm test` alone catches a regression. A `t.has(key) ? t(key) : "..."`
 * guard is the supported way to render a key that may be absent, and is not
 * flagged.
 */

const root = path.resolve(import.meta.dirname, "../..");
const sourcesDir = path.join(root, "module-sources");
const coreMessagesDir = path.join(root, "messages-core");

type Catalogue = Record<string, Record<string, Record<string, string>>>;

const locales = fs
    .readdirSync(coreMessagesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.basename(f, ".json"));

const coreMessages: Catalogue = Object.fromEntries(
    locales.map((locale) => [
        locale,
        JSON.parse(fs.readFileSync(path.join(coreMessagesDir, `${locale}.json`), "utf8")),
    ]),
);

function sourceFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
}

/** Keys a module renders through `t("literal")` without a `t.has()` guard. */
function renderedKeys(modulePath: string): { file: string; namespace: string; key: string }[] {
    const found: { file: string; namespace: string; key: string }[] = [];

    for (const file of sourceFiles(modulePath)) {
        const content = fs.readFileSync(file, "utf8");
        if (!content.includes("Translations(")) continue;

        const bindings = new Map<string, string>();
        const bindingPattern =
            /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*["'`]([^"'`]+)["'`]/g;
        for (const match of content.matchAll(bindingPattern)) bindings.set(match[1], match[2]);

        for (const [binding, namespace] of bindings) {
            const callPattern = new RegExp(`\\b${binding}\\s*\\(\\s*["'\`]([^"'\`$]+)["'\`]`, "g");
            for (const match of content.matchAll(callPattern)) {
                const key = match[1];
                const guard = new RegExp(
                    `\\b${binding}\\.has\\s*\\(\\s*["'\`]${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`,
                );
                if (guard.test(content)) continue;
                found.push({ file: path.relative(modulePath, file), namespace, key });
            }
        }
    }

    return found;
}

/**
 * Keys a module renders through a `t.has(key) ? t(key) : "literal"` guard.
 *
 * The guard is the supported way to render a key that may be absent, and it
 * exists for a real case: translations are seeded into the database when a
 * module is installed, so an install running an older copy of the module has
 * none of the keys a newer release added, and the guard keeps that screen
 * from rendering key paths until the seed catches up.
 *
 * What it cannot do is stand in for the translation. If the key is missing
 * from the module's own shipped catalogue too, then no install will ever have
 * it, the guard is taken forever, and the literal on the right is the string
 * every locale gets. That is how the store shipped its cart errors, its
 * "added to cart" toast, its cart aria-label and its product thumbnail alt
 * text in English to every Turkish shopper: each one guarded, each one
 * guarded against a key that was never written.
 */
function guardedKeys(modulePath: string): { file: string; namespace: string; key: string }[] {
    const found: { file: string; namespace: string; key: string }[] = [];

    for (const file of sourceFiles(modulePath)) {
        const content = fs.readFileSync(file, "utf8");
        if (!content.includes("Translations(")) continue;

        const bindings = new Map<string, string>();
        const bindingPattern =
            /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*["'`]([^"'`]+)["'`]/g;
        for (const match of content.matchAll(bindingPattern)) bindings.set(match[1], match[2]);

        for (const [binding, namespace] of bindings) {
            const guardPattern = new RegExp(`\\b${binding}\\.has\\s*\\(\\s*["'\`]([^"'\`$]+)["'\`]`, "g");
            for (const match of content.matchAll(guardPattern)) {
                found.push({ file: path.relative(modulePath, file), namespace, key: match[1] });
            }
        }
    }

    return found;
}

const modules = fs
    .readdirSync(sourcesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(sourcesDir, e.name, "module.json")))
    .map((e) => e.name);

describe("module translation keys", () => {
    it("has modules to check", () => {
        expect(modules.length).toBeGreaterThan(50);
    });

    it.each(modules)("%s declares every key it renders", (id) => {
        const modulePath = path.join(sourcesDir, id);
        const manifest = JSON.parse(
            fs.readFileSync(path.join(modulePath, "module.json"), "utf8"),
        ) as { translations?: Catalogue };
        const translations = manifest.translations;
        if (!translations) return;

        const missing: string[] = [];
        for (const { file, namespace, key } of renderedKeys(modulePath)) {
            for (const locale of locales) {
                const bucket = translations[locale]?.[namespace];
                // A namespace the module does not declare belongs to core or
                // to another module, and is not this module's to carry.
                if (!bucket) continue;
                // At runtime the catalogue is core merged with the enabled
                // modules, so a key core owns resolves.
                if (coreMessages[locale]?.[namespace]?.[key] !== undefined) continue;
                if (bucket[key] === undefined) missing.push(`${file}: ${namespace}.${key} (${locale})`);
            }
        }

        expect(missing, `${id} renders keys it never declared`).toEqual([]);
    });
});

describe("module translation guards", () => {
    it.each(modules)("%s ships every key it guards", (id) => {
        const modulePath = path.join(sourcesDir, id);
        const manifest = JSON.parse(
            fs.readFileSync(path.join(modulePath, "module.json"), "utf8"),
        ) as { translations?: Catalogue };
        const translations = manifest.translations;
        if (!translations) return;

        const permanent: string[] = [];
        for (const { file, namespace, key } of guardedKeys(modulePath)) {
            for (const locale of locales) {
                const bucket = translations[locale]?.[namespace];
                if (!bucket) continue;
                if (coreMessages[locale]?.[namespace]?.[key] !== undefined) continue;
                if (bucket[key] === undefined) {
                    permanent.push(`${file}: ${namespace}.${key} (${locale})`);
                }
            }
        }

        expect(
            permanent,
            `${id} guards keys it never ships, so the English literal is what every locale gets`,
        ).toEqual([]);
    });
});
