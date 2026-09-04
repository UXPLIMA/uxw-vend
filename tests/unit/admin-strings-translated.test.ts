import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

/**
 * The admin panel is read in the operator's language too.
 *
 * Ninety strings across twenty-three admin screens were written in English
 * directly in the JSX. Twenty-four of them already had a key sitting in the
 * catalogue that nothing referenced, so the translation had been written and
 * then never wired up: the spotlight's four labels, the sidebar search
 * placeholder, the appearance heading, and more.
 *
 * This mirrors `public-strings-translated.test.ts` for the admin tree.
 */
const DIRS = ["src/app/[locale]/(admin)", "src/core/components/admin"];

/** Names that stay as they are in every language. */
const BRAND_NAMES = new Set([
    "Discord", "Twitter / X", "YouTube", "Instagram", "Facebook", "Redis",
    "Node.js", "Prisma", "Postgres", "PostgreSQL", "Stripe", "PayPal",
    "Cloudflare", "Minecraft", "GitHub", "Google", "Promise",
]);

function componentFiles(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        if (!fs.existsSync(d)) return;
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.tsx$/.test(entry.name)) out.push(full);
        }
    };
    walk(dir);
    return out;
}

/**
 * Sentence-shaped English: starts with a capital, contains a lowercase letter,
 * and is short enough to be a label rather than prose in a comment.
 */
function looksLikeCopy(text: string): boolean {
    if (BRAND_NAMES.has(text)) return false;
    if (!/[a-z]/.test(text)) return false;
    if (!/^[A-Z][A-Za-z0-9 ,.'()/&:%!?-]*$/.test(text)) return false;
    return text.split(/\s+/).length <= 12;
}

function offendersIn(source: string, file: string): string[] {
    const found: string[] = [];
    const at = (index: number) => `${file}:${source.slice(0, index).split("\n").length}`;
    for (const match of source.matchAll(/>([^<>{}]+)</g)) {
        const text = match[1].trim();
        if (text && looksLikeCopy(text)) found.push(`${at(match.index ?? 0)}  ${text}`);
    }
    for (const match of source.matchAll(/\b(placeholder|title|aria-label)="([^"]+)"/g)) {
        const text = match[2].trim();
        if (looksLikeCopy(text)) found.push(`${at(match.index ?? 0)}  ${match[1]}="${text}"`);
    }
    return found;
}

describe("admin panel copy", () => {
    it("is never written in English in the JSX", () => {
        const offenders: string[] = [];
        for (const dir of DIRS) {
            for (const file of componentFiles(path.join(ROOT, dir))) {
                offenders.push(...offendersIn(fs.readFileSync(file, "utf8"), path.relative(ROOT, file)));
            }
        }
        expect(offenders).toEqual([]);
    });

    it("finds the screens it is meant to be checking", () => {
        const count = DIRS.reduce((total, dir) => total + componentFiles(path.join(ROOT, dir)).length, 0);
        expect(count).toBeGreaterThan(40);
    });
});

/**
 * A key nothing renders is a translation nobody sees. This does not demand
 * that every key be used - the catalogue outlives any one screen - but it does
 * demand that the ones this round wired up stay wired.
 */
describe("keys that were sitting unused", () => {
    const WIRED: [string, string][] = [
        ["src/core/components/admin/AdminSpotlight.tsx", "spotlight_startTyping"],
        ["src/core/components/admin/AdminSpotlight.tsx", "spotlight_noResults"],
        ["src/core/components/admin/AdminSpotlight.tsx", "spotlight_navigate"],
        ["src/core/components/admin/AdminSpotlight.tsx", "spotlight_open"],
        ["src/core/components/admin/AdminSpotlight.tsx", "spotlight_placeholder"],
        ["src/core/components/admin/AdminSearch.tsx", "search_placeholder"],
        ["src/app/[locale]/(admin)/admin/settings/theme/page.tsx", "settings_appearance"],
        ["src/app/[locale]/(admin)/admin/api-docs/page.tsx", "apiDocs_loading"],
    ];

    it("are read by the screen they were written for", () => {
        for (const [file, key] of WIRED) {
            const source = fs.readFileSync(path.join(ROOT, file), "utf8");
            expect(source, `${file} should render ${key}`).toContain(`("${key}")`);
        }
    });

    it("and exist in every locale core ships", () => {
        const locales = fs.readdirSync(path.join(ROOT, "messages-core"))
            .filter((f) => f.endsWith(".json"))
            .map((f) => f.replace(/\.json$/, ""));
        expect(locales.length).toBeGreaterThan(1);
        for (const locale of locales) {
            const messages = JSON.parse(
                fs.readFileSync(path.join(ROOT, `messages-core/${locale}.json`), "utf8"),
            ) as { admin: Record<string, string> };
            for (const [, key] of WIRED) {
                expect(messages.admin[key], `${locale} is missing admin.${key}`).toBeTruthy();
            }
        }
    });
});

/**
 * The scan above only reads `.tsx`, because that is where JSX lives. The admin
 * modules screen keeps its logic in a `.ts` hook, and every toast and
 * confirmation it raised was written in English there: "installed", "deleted",
 * "updated to v...", "Install N modules?", "Failed: ...". Four more read
 * `t.has(key) ? t(key) : "English"` for keys that were in the catalogue all
 * along, so the fallback was unreachable and the English was decoration.
 */
function messageLiterals(source: string, file: string): string[] {
    const found: string[] = [];
    const at = (index: number) => `${file}:${source.slice(0, index).split("\n").length}`;

    // A toast, or a confirm dialog's own copy, given a literal rather than a key.
    const patterns = [
        /toast\.(?:success|error|info|warning|message)\(\s*([`"'])((?:[^\\]|\\.)*?)\1/g,
        /\b(?:message|title|confirmText|cancelText)\s*:\s*([`"'])((?:[^\\]|\\.)*?)\1/g,
    ];
    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
            // Strip interpolations so `${count} modules` still reads as English.
            const text = match[2].replace(/\$\{[^}]*\}/g, "").trim();
            if (text && looksLikeCopy(text)) found.push(`${at(match.index ?? 0)}  ${text}`);
        }
    }
    return found;
}

/**
 * A fallback for a key that exists is unreachable. next-intl does not throw on
 * a missing message - it returns the key path - so `t.has` is the right guard
 * where a key genuinely may be absent, and dead weight everywhere else.
 */
function deadTranslationFallbacks(source: string, file: string, catalogue: Record<string, string>): string[] {
    const found: string[] = [];
    const at = (index: number) => `${file}:${source.slice(0, index).split("\n").length}`;
    for (const match of source.matchAll(/t\.has\("([^"]+)"\)/g)) {
        if (catalogue[match[1]] !== undefined) {
            found.push(`${at(match.index ?? 0)}  t.has("${match[1]}") guards a key that exists`);
        }
    }
    return found;
}

describe("admin logic files", () => {
    const catalogue = (JSON.parse(
        fs.readFileSync(path.join(ROOT, "messages-core/en.json"), "utf8"),
    ) as { admin: Record<string, string> }).admin;

    function logicFiles(dir: string): string[] {
        const out: string[] = [];
        const walk = (d: string) => {
            if (!fs.existsSync(d)) return;
            for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (/\.tsx?$/.test(entry.name)) out.push(full);
            }
        };
        walk(dir);
        return out;
    }

    const files = DIRS.flatMap((dir) => logicFiles(path.join(ROOT, dir)));

    it("raise no toast or dialog written in English", () => {
        const offenders = files.flatMap((file) =>
            messageLiterals(fs.readFileSync(file, "utf8"), path.relative(ROOT, file)),
        );
        expect(offenders).toEqual([]);
    });

    it("guard with t.has only where the key really may be missing", () => {
        const offenders = files.flatMap((file) =>
            deadTranslationFallbacks(fs.readFileSync(file, "utf8"), path.relative(ROOT, file), catalogue),
        );
        expect(offenders).toEqual([]);
    });
});
