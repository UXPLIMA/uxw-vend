/**
 * The module validator's TypeScript check has to use a program that actually
 * contains the module.
 *
 * It used to run `tsc --project tsconfig.json` and keep the error lines whose
 * path contained `module-sources/<id>`. That config excludes `module-sources/`
 * outright, so the program held none of the files being validated and the
 * filter matched nothing: every module passed, whatever was in it. A bad SDK
 * import shipped through this check and was caught minutes later by the real
 * gate. These tests pin the two facts that made the old approach impossible,
 * so it cannot be reintroduced quietly.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = process.cwd();
const validator = fs.readFileSync(path.join(root, "scripts", "validate-module.ts"), "utf8");

/**
 * Comment lines are stripped before the "does not do X" assertions below: the
 * file explains the old mistake in prose, and a gate that trips over its own
 * explanation teaches people to delete the explanation.
 */
const validatorCode = validator
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

describe("validate-module TypeScript check", () => {
    it("runs the typecheck that can see module-sources", () => {
        expect(validator).toContain("scripts/typecheck-modules.ts");
    });

    // The specific mistake: pointing tsc at the main project.
    it("does not compile the module against the main tsconfig", () => {
        expect(validatorCode).not.toMatch(/tsc[^\n]*--project[^\n]*tsconfig\.json/);
    });

    it("the main tsconfig really does exclude the sources being validated", () => {
        const tsconfig = JSON.parse(
            fs
                .readFileSync(path.join(root, "tsconfig.json"), "utf8")
                // The config carries `//` comment keys, which JSON.parse takes,
                // but no trailing commas to strip.
                .replace(/^\s*\/\/.*$/gm, ""),
        ) as { exclude?: string[] };
        expect(tsconfig.exclude ?? []).toContain("module-sources");
    });

    // A module kept outside module-sources cannot be reached by that program,
    // and the check has to say so rather than report a pass it did not earn.
    it("says so when a module is somewhere it cannot be checked", () => {
        expect(validator).toContain("only modules under module-sources/ can be type-checked");
    });
});
