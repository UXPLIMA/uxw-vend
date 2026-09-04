/**
 * A module declares translations in the languages the site can actually show.
 *
 * Seventy-seven of the seventy-eight modules shipped seven locales in their
 * manifest: en, tr, de, es, fr, ru and pt. Core ships two. `seed-translations`
 * filters every row through `locales` from the i18n config before it writes
 * to the Translation table, so the other five had never reached a page and
 * never could - twelve thousand seven hundred and twenty keys that no visitor
 * could read.
 *
 * They also rotted, quietly, because nothing checked them: thirty-five
 * modules were missing keys in those locales that en and tr had (the store
 * a hundred and forty of them), and `validate-module` only requires the
 * locales core ships, so no gate ever said so. Every key added to a module
 * meant a choice between writing five translations nobody would read or
 * widening the drift.
 *
 * They are gone. Adding a language is now one decision in one place: add it
 * to `locales` in `src/core/lib/i18n/config.ts`, ship
 * `messages-core/<locale>.json`, and the modules follow. This gate keeps a
 * manifest from getting ahead of that.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { locales } from "@/core/lib/i18n/config";

const ROOT = join(__dirname, "../..");
const SOURCES = join(ROOT, "module-sources");

function manifests(): { id: string; manifest: Record<string, unknown> }[] {
    if (!existsSync(SOURCES)) return [];
    return readdirSync(SOURCES, { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(join(SOURCES, e.name, "module.json")))
        .map((e) => ({
            id: e.name,
            manifest: JSON.parse(readFileSync(join(SOURCES, e.name, "module.json"), "utf-8")),
        }));
}

describe("module manifests", () => {
    it("finds every module", () => {
        expect(manifests().length).toBeGreaterThan(70);
    });

    it("declare no locale the site cannot show", () => {
        const supported = new Set<string>(locales);
        const offenders: string[] = [];
        for (const { id, manifest } of manifests()) {
            const translations = manifest.translations;
            if (!translations || typeof translations !== "object") continue;
            for (const locale of Object.keys(translations)) {
                if (!supported.has(locale)) offenders.push(`${id}: ${locale}`);
            }
        }
        expect(
            offenders,
            `Core ships ${[...supported].join(", ")}. Add a locale to ` +
                `src/core/lib/i18n/config.ts and messages-core/ before a module ` +
                `declares it:\n${offenders.join("\n")}`,
        ).toEqual([]);
    });

    it("declare every locale the site can show", () => {
        const offenders: string[] = [];
        for (const { id, manifest } of manifests()) {
            const translations = manifest.translations as Record<string, unknown> | undefined;
            if (!translations || typeof translations !== "object") continue;
            for (const locale of locales) {
                if (!(locale in translations)) offenders.push(`${id}: missing ${locale}`);
            }
        }
        expect(offenders, offenders.join("\n")).toEqual([]);
    });

    it("carry the same keys in every locale they declare", () => {
        const offenders: string[] = [];
        for (const { id, manifest } of manifests()) {
            const translations = manifest.translations as Record<string, Record<string, Record<string, string>>> | undefined;
            if (!translations) continue;
            const declared = Object.keys(translations);
            if (declared.length < 2) continue;
            const reference = declared[0];
            const keysOf = (locale: string) =>
                new Set(
                    Object.entries(translations[locale] ?? {}).flatMap(([ns, bucket]) =>
                        Object.keys(bucket ?? {}).map((k) => `${ns}.${k}`),
                    ),
                );
            const base = keysOf(reference);
            for (const locale of declared.slice(1)) {
                const here = keysOf(locale);
                const missing = [...base].filter((k) => !here.has(k));
                const extra = [...here].filter((k) => !base.has(k));
                if (missing.length) offenders.push(`${id}/${locale}: missing ${missing.length} (${missing.slice(0, 3).join(", ")})`);
                if (extra.length) offenders.push(`${id}/${locale}: has ${extra.length} not in ${reference} (${extra.slice(0, 3).join(", ")})`);
            }
        }
        expect(offenders, offenders.join("\n")).toEqual([]);
    });
});
