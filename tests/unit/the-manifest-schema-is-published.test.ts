/**
 * The rules a manifest is judged by are published, not just enforced.
 *
 * Anything that accepts a module from an author has to know what a manifest
 * may say: a marketplace, an editor, a linter in somebody else's repository.
 * Without a published schema each of them writes its own guess, and the first
 * package that passes one and fails another is a support ticket nobody can
 * answer.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "module-marketplace/manifest-schema.json");

describe("the published manifest schema", () => {
    it("is in the marketplace, beside the catalogue it describes", () => {
        expect(fs.existsSync(FILE)).toBe(true);
    });

    it("is a JSON Schema document", () => {
        const schema = JSON.parse(fs.readFileSync(FILE, "utf8"));
        expect(schema.$schema).toContain("json-schema.org");
        expect(schema.type).toBe("object");
    });

    it("describes the fields a manifest actually carries", () => {
        const schema = JSON.parse(fs.readFileSync(FILE, "utf8"));
        for (const field of ["id", "name", "version", "coreVersion", "menu", "routes", "api"]) {
            expect(Object.keys(schema.properties), field).toContain(field);
        }
    });

    it("requires the fields nothing can be installed without", () => {
        const schema = JSON.parse(fs.readFileSync(FILE, "utf8"));
        for (const field of ["id", "name", "version"]) {
            expect(schema.required, field).toContain(field);
        }
    });
});
