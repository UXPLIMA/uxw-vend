import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * What a visitor sees is translated.
 *
 * The public chrome had English baked into it: the maintenance page's
 * heading and its sign-in button, the activity page's title and description
 * (including the ones a crawler reads out of the metadata), the homepage
 * activity section's heading and its "View all" link, the file upload
 * control, and the navigation landmark labels that a screen reader reads to
 * tell one nav apart from another. A Turkish visitor got those in English.
 *
 * The rule holds for the public tree only. `app/error.tsx`,
 * `app/not-found.tsx` and the two error boundaries stay in English on
 * purpose: they render either outside the locale layout or from a class
 * component, in both cases with no provider to ask.
 */

const root = path.resolve(import.meta.dirname, "../..");

const PUBLIC_SURFACE = [
    "src/app/[locale]/(public)",
    // Sign in, register, forgot and reset password, verify email, auth error.
    // The most-read pages on a fresh install and covered by neither gate
    // until now, which is how the register form kept an English placeholder
    // and its sibling login page did not.
    "src/app/[locale]/(auth)",
    "src/app/[locale]/maintenance",
    "src/core/components/layout",
    "src/core/components/homepage",
];

/**
 * A module's own visitor-facing surface, which no gate watched either. The
 * whole of the public ticket page was in English, as were the referral tab
 * on a user's profile, the custom page 404, the announcement dismiss button,
 * the store's payment-goal banner and four page-builder blocks' empty
 * states. Most of those keys already existed in every locale of the module's
 * manifest; the components had simply never been wired to them.
 */
const MODULE_SURFACE = ["pages/public", "blocks", "slots", "widgets", "components"];

/** Proper nouns. A brand is spelled the same in every locale. */
const BRAND_NAMES = new Set([
    "Facebook", "Instagram", "X (Twitter)", "YouTube", "Discord", "Twitch", "TikTok",
    // Reached once the scan covers the modules. A game, two payment
    // providers, and the example username every Minecraft screenshot uses.
    "Twitter", "Minecraft", "Stripe", "PayPal", "Notch",
]);

function tsxFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) tsxFiles(full, out);
        else if (entry.name.endsWith(".tsx")) out.push(full);
    }
    return out;
}

function isTranslatable(text: string): boolean {
    if (BRAND_NAMES.has(text)) return false;
    // A word the user has to type back verbatim, or an acronym.
    if (!/[a-z]/.test(text)) return false;
    // An example value rather than prose.
    if (/^https?:\/\//.test(text)) return false;
    return true;
}

function englishLiterals(file: string): string[] {
    const source = fs.readFileSync(file, "utf8");
    const found: string[] = [];

    // A JSX text node that reads like a sentence or a label.
    for (const match of source.matchAll(/>\s*([A-Z][A-Za-z][A-Za-z'’,.!?%: -]{3,60})\s*</g)) {
        const text = match[1].trim();
        if (isTranslatable(text)) found.push(`text: ${text}`);
    }

    // A label a screen reader reads, written as a literal.
    for (const match of source.matchAll(/(placeholder|aria-label|title)=["']([^"']{2,60})["']/g)) {
        if (isTranslatable(match[2])) found.push(`${match[1]}: ${match[2]}`);
    }

    return found.map((hit) => `${path.relative(root, file)} -> ${hit}`);
}

function moduleSurfaceFiles(): string[] {
    const sources = path.join(root, "module-sources");
    if (!fs.existsSync(sources)) return [];
    return fs
        .readdirSync(sources, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .flatMap((mod) =>
            MODULE_SURFACE.flatMap((sub) => tsxFiles(path.join(sources, mod.name, sub))),
        );
}

describe("the public surface", () => {
    const files = PUBLIC_SURFACE.flatMap((dir) => tsxFiles(path.join(root, dir)));

    it("covers the pages and the chrome a visitor sees", () => {
        expect(files.length).toBeGreaterThan(5);
    });

    it("has no English baked into it", () => {
        expect(files.flatMap(englishLiterals)).toEqual([]);
    });
});

describe("the modules' public surface", () => {
    const files = moduleSurfaceFiles();

    it("covers every module's pages, blocks, slots, widgets and components", () => {
        expect(files.length).toBeGreaterThan(50);
    });

    it("has no English baked into it", () => {
        expect(files.flatMap(englishLiterals)).toEqual([]);
    });
});
