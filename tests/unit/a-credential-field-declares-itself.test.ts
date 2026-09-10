/**
 * How core learns which settings are credentials without being told by name.
 *
 * Sealing a credential needs a list of which keys are credentials, and core
 * may not hold that list: `paytr_merchant_key` in a core file is core naming a
 * module, and three CI gates exist to stop exactly that. So a module declares
 * its own in `secretSettings`, core reads the aggregate, and this file is what
 * makes the declaration reliable.
 *
 * A list somebody has to remember to update is a list that is wrong. The one
 * place a module already says "this value is a credential" is its settings
 * screen, where the field is `type: "password"` - every gateway had marked
 * theirs correctly years before anything encrypted them. So that marking is
 * the source of truth and the declaration is checked against it: add a
 * password field without declaring it and CI fails here, which is the only
 * version of this that survives the next gateway module somebody writes.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCES = path.join(ROOT, "module-sources");

interface Manifest {
    id: string;
    secretSettings?: string[];
}

const modules = fs
    .readdirSync(SOURCES, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(SOURCES, e.name, "module.json")))
    .map((e) => ({
        id: e.name,
        dir: path.join(SOURCES, e.name),
        manifest: JSON.parse(fs.readFileSync(path.join(SOURCES, e.name, "module.json"), "utf8")) as Manifest,
    }));

function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) sourceFiles(full, out);
        else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
}

/**
 * Every `{ key: "...", ... type: "password" }` a module's *settings* screen
 * declares.
 *
 * Only screens built on `SettingsForm`, because only those write to the site
 * settings store. A password field on a resource form is a column on that
 * module's own table - the servers module's RCON password is one, and it is
 * already encrypted where it lives.
 */
function passwordFieldKeys(dir: string): string[] {
    const keys: string[] = [];
    for (const file of sourceFiles(dir)) {
        const source = fs.readFileSync(file, "utf8");
        if (!source.includes("SettingsForm")) continue;
        // The field object is written across one line or several, so match
        // from the key to the type without letting the window cross into the
        // next field: a `}` ends the object.
        for (const match of source.matchAll(/key:\s*"([a-zA-Z0-9_]+)"[^}]*?type:\s*"password"/g)) {
            keys.push(match[1]);
        }
    }
    return [...new Set(keys)];
}

describe("every credential an operator can type", () => {
    it.each(modules.map((m) => m.id))("is declared by %s", (id) => {
        const found = modules.find((m) => m.id === id);
        if (!found) throw new Error(`unknown module ${id}`);
        const declared = new Set(found.manifest.secretSettings ?? []);
        const undeclared = passwordFieldKeys(found.dir).filter((key) => !declared.has(key));
        expect(undeclared).toEqual([]);
    });

    it("covers the two that are a field inside a stored object", () => {
        // These two do not use the shared settings form: they POST a whole
        // config object to their own endpoint, so the credential is a field
        // rather than a key and the declaration has to say which field.
        const byId = new Map(modules.map((m) => [m.id, m.manifest]));
        expect(byId.get("cloudflare-r2")?.secretSettings).toContain("cloudflare_r2_config.secretKey");
        expect(byId.get("cloudflare-turnstile")?.secretSettings).toContain(
            "cloudflare_turnstile_config.secretKey",
        );
    });

    it("finds the gateways this was built for", () => {
        // A sanity check on the scan itself: if the regex above stops
        // matching, every module passes vacuously and the gate is decoration.
        const all = modules.flatMap((m) => passwordFieldKeys(m.dir));
        expect(all).toContain("paytr_merchant_salt");
        expect(all).toContain("stripe_secret_key");
        expect(all).toContain("paypal_client_secret");
        expect(all.length).toBeGreaterThan(20);
    });
});

describe("a declaration", () => {
    it("names a key the module actually uses", () => {
        const dead: string[] = [];
        for (const { id, dir, manifest } of modules) {
            const sources = sourceFiles(dir).map((f) => fs.readFileSync(f, "utf8")).join("\n");
            for (const declared of manifest.secretSettings ?? []) {
                const [key, field] = declared.split(".");
                if (!sources.includes(key)) dead.push(`${id}: ${declared}`);
                else if (field && !sources.includes(field)) dead.push(`${id}: ${declared}`);
            }
        }
        expect(dead).toEqual([]);
    });
});

describe("reading a credential", () => {
    it("goes through the boundary, never straight off the row", () => {
        // A module that pulls the row itself gets ciphertext and signs a
        // payment with it - a failure that looks like the provider rejecting
        // the operator's key, which is the hardest kind to diagnose.
        // A file is only asked about a credential it actually touches. The
        // public Turnstile endpoint reads the same row and returns the site
        // key and two switches by name, never the secret beside them, so it
        // has no credential to open - and making it open one would decrypt a
        // value on an unauthenticated path only to discard it.
        const BOUNDARY = /readSettingValues|readSettingStrings|settingsFromStorage|settingsForStorage|withoutSecrets|openValue/;

        const raw: string[] = [];
        for (const { id, dir, manifest } of modules) {
            const declared = manifest.secretSettings ?? [];
            if (declared.length === 0) continue;
            for (const file of sourceFiles(dir)) {
                const source = fs.readFileSync(file, "utf8");
                if (!source.includes("prisma.setting")) continue;
                const touches = declared.some((path) => {
                    const [key, field] = path.split(".");
                    if (!source.includes(key)) return false;
                    return field === undefined || source.includes(field);
                });
                if (!touches) continue;
                if (!BOUNDARY.test(source)) raw.push(`${id}: ${path.relative(ROOT, file)}`);
            }
        }
        expect(raw).toEqual([]);
    });
});

describe("core", () => {
    it("names none of them", () => {
        // `src/core/generated` is the aggregate itself: holding every declared
        // name is what it is for, and it is written by codegen, not by hand.
        const coreFiles = [
            ...sourceFiles(path.join(ROOT, "src/core")),
            ...sourceFiles(path.join(ROOT, "src/app")),
        ].filter((f) => !f.includes(`${path.sep}generated${path.sep}`));
        const everyDeclared = modules.flatMap((m) => m.manifest.secretSettings ?? []);
        const named: string[] = [];
        for (const file of coreFiles) {
            const source = fs.readFileSync(file, "utf8");
            for (const key of everyDeclared) {
                if (source.includes(key)) named.push(`${path.relative(ROOT, file)}: ${key}`);
            }
        }
        expect(named).toEqual([]);
    });
});
