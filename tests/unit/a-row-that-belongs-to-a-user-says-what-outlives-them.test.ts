import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * What happens to a row when the user it belongs to goes.
 *
 * Prisma answers this whether or not the schema does: a required relation
 * with no `onDelete` becomes `RESTRICT`, an optional one becomes `SET NULL`.
 * Both are decisions, and both were made here by omission rather than by
 * anyone choosing them.
 *
 * Measured against the running database, 43 foreign keys point at `User`:
 * 19 cascade, 23 null out, and exactly one restricts. That one is
 * `ChestItem.userId`, and restrict means the row refuses to let the user be
 * deleted at all. Deletion here is an anonymisation rather than a `DELETE`,
 * so nothing has hit it yet, which is the whole problem with a default: it
 * waits.
 *
 * The rule this pins is not which action is right. It is that the schema
 * says which, at the line a reader is already looking at.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

function schemaFiles(): string[] {
    const core = path.join(ROOT, "prisma/schema.core.prisma");
    const moduleDir = path.join(ROOT, "module-sources");
    const modules = fs
        .readdirSync(moduleDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(moduleDir, e.name, "schema.prisma"))
        .filter((f) => fs.existsSync(f));
    return [core, ...modules];
}

/** `user User @relation(...)` and `redeemedBy User? @relation(...)` alike. */
const USER_RELATION = /\bUser\??\s+@relation\(/;

describe("a row that belongs to a user", () => {
    const relations = schemaFiles().flatMap((file) => {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        let model = "";
        return lines.flatMap((line) => {
            const declared = /^model\s+(\w+)/.exec(line);
            if (declared) model = declared[1];
            if (!USER_RELATION.test(line)) return [];
            return [{
                where: `${path.relative(ROOT, file)}: ${model}`,
                line: line.trim(),
                states: line.includes("onDelete"),
            }];
        });
    });

    it("finds the relations to check", () => {
        expect(relations.length).toBeGreaterThanOrEqual(40);
    });

    it("says what outlives them, rather than letting Prisma decide", () => {
        const silent = relations.filter((r) => !r.states).map((r) => `${r.where}\n    ${r.line}`);

        expect(
            silent,
            `These leave it to Prisma's default: RESTRICT for a required relation,\n` +
            `SET NULL for an optional one. Write the one you mean:\n${silent.join("\n")}`,
        ).toEqual([]);
    });
});
