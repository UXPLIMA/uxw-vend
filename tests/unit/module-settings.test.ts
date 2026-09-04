import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A module's `settings` declaration is the only thing that makes an admin
 * setting real: it supplies the form control, the input validation, the stored
 * value's shape and the default the module reads.
 *
 * The defect this guards against is the one that was actually shipped: five
 * modules declared sixteen keys under the old `defaultConfig` field, core
 * merged them into an API response, and not one key was read by anything. The
 * admin screen showed none of them either, so nothing about the system said
 * they were dead.
 */

const SOURCES = path.join(process.cwd(), "module-sources");

function modules(): string[] {
    return fs
        .readdirSync(SOURCES, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
}

function manifest(id: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(SOURCES, id, "module.json"), "utf8"));
}

function sourceText(id: string): string {
    const parts: string[] = [];
    (function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules") continue;
                walk(full);
            } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
                parts.push(fs.readFileSync(full, "utf8"));
            }
        }
    })(path.join(SOURCES, id));
    return parts.join("\n");
}

interface Declaration {
    key: string;
    type: string;
    default: unknown;
    label: string;
    description?: string;
    min?: number;
    max?: number;
    maxLength?: number;
}

function declarations(id: string): Declaration[] {
    return (manifest(id).settings as Declaration[] | undefined) ?? [];
}

describe("declared settings", () => {
    it("is read by the module that declares it", () => {
        const unread: string[] = [];
        for (const id of modules()) {
            const declared = declarations(id);
            if (declared.length === 0) continue;
            const body = sourceText(id);
            for (const setting of declared) {
                if (!new RegExp(`\\b${setting.key}\\b`).test(body)) {
                    unread.push(`${id}.${setting.key}`);
                }
            }
        }
        expect(unread).toEqual([]);
    });

    it("has no module still carrying the old defaultConfig field", () => {
        const stragglers = modules().filter((id) => "defaultConfig" in manifest(id));
        expect(stragglers).toEqual([]);
    });

    it("declares a default matching its own type", () => {
        const wrong: string[] = [];
        for (const id of modules()) {
            for (const setting of declarations(id)) {
                if (typeof setting.default !== setting.type) wrong.push(`${id}.${setting.key}`);
            }
        }
        expect(wrong).toEqual([]);
    });

    it("gives every number setting bounds that contain its default", () => {
        const bad: string[] = [];
        for (const id of modules()) {
            for (const setting of declarations(id)) {
                if (setting.type !== "number") continue;
                const { min, max } = setting;
                if (min === undefined || max === undefined || min > max) { bad.push(`${id}.${setting.key}`); continue; }
                const value = setting.default as number;
                if (value < min || value > max) bad.push(`${id}.${setting.key}`);
            }
        }
        expect(bad).toEqual([]);
    });

    it("labels every setting", () => {
        const unlabelled: string[] = [];
        for (const id of modules()) {
            for (const setting of declarations(id)) {
                if (!setting.label || setting.label.trim().length === 0) unlabelled.push(`${id}.${setting.key}`);
            }
        }
        expect(unlabelled).toEqual([]);
    });

    it("uses each key at most once per module", () => {
        const dupes: string[] = [];
        for (const id of modules()) {
            const keys = declarations(id).map((s) => s.key);
            if (new Set(keys).size !== keys.length) dupes.push(id);
        }
        expect(dupes).toEqual([]);
    });
});
