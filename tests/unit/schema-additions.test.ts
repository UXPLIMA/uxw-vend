// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseDiffScript, isAdditiveAlterTable, planFromScript } from "../../scripts/apply-schema-additions";

/**
 * The filter that keeps a runtime schema sync from ever removing anything.
 *
 * `prisma db push` was the obvious tool and is the wrong one: uninstall
 * leaves a module's tables in place on purpose, so the database legitimately
 * holds tables the merged schema does not declare, and push answers that
 * either by dropping them (silently, when empty) or by refusing to run at all
 * (when they have rows — which then leaves the module being installed with no
 * tables either). Both were reproduced against a real install.
 */

const SCRIPT = `Loaded Prisma config from prisma.config.ts.

-- DropTable
DROP TABLE "OrphanWithData";

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "BlogTag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "BlogTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogTag_slug_key" ON "BlogTag"("slug");

-- AddForeignKey
ALTER TABLE "BlogComment" ADD CONSTRAINT "BlogComment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "BlogArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`;

describe("parseDiffScript", () => {
    it("drops the preamble Prisma prints before the first annotation", () => {
        const statements = parseDiffScript(SCRIPT);
        expect(statements.every((s) => !s.sql.includes("Loaded Prisma config"))).toBe(true);
    });

    it("pairs each statement with the operation Prisma annotated it with", () => {
        expect(parseDiffScript(SCRIPT).map((s) => s.operation)).toEqual([
            "DropTable", "CreateEnum", "CreateTable", "CreateIndex", "AddForeignKey",
        ]);
    });

    it("keeps a multi-line statement whole", () => {
        const table = parseDiffScript(SCRIPT).find((s) => s.operation === "CreateTable");
        expect(table?.sql).toContain("CREATE TABLE");
        expect(table?.sql).toContain("BlogTag_pkey");
        expect(table?.sql.trimEnd().endsWith(";")).toBe(true);
    });

    it("returns nothing for a script with no statements", () => {
        expect(parseDiffScript("Loaded Prisma config from prisma.config.ts.\n")).toEqual([]);
    });

    it("does not mistake an indented comment inside a statement for an annotation", () => {
        const parsed = parseDiffScript(`-- CreateTable\nCREATE TABLE "A" (\n  -- note\n  id TEXT\n);\n`);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]?.sql).toContain("-- note");
    });

    it("does not split a statement on an unindented comment before its semicolon", () => {
        // Splitting here would run "CREATE TABLE \"A\" (" on its own.
        const parsed = parseDiffScript(`-- CreateTable\nCREATE TABLE "A" (\n-- note\nid TEXT\n);\n`);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]?.sql).toContain("id TEXT");
    });
});

describe("isAdditiveAlterTable", () => {
    it("accepts an ADD COLUMN", () => {
        expect(isAdditiveAlterTable('ALTER TABLE "A" ADD COLUMN "b" TEXT;')).toBe(true);
    });

    it("rejects a DROP COLUMN", () => {
        expect(isAdditiveAlterTable('ALTER TABLE "A" DROP COLUMN "b";')).toBe(false);
    });

    it("rejects a statement that adds and drops in one breath", () => {
        expect(isAdditiveAlterTable('ALTER TABLE "A" ADD COLUMN "b" TEXT, DROP COLUMN "c";')).toBe(false);
    });

    it("rejects a type change, which can lose data on its own", () => {
        expect(isAdditiveAlterTable('ALTER TABLE "A" ALTER COLUMN "b" SET DATA TYPE INTEGER;')).toBe(false);
    });

    it("rejects an ALTER TABLE that neither adds nor drops", () => {
        expect(isAdditiveAlterTable('ALTER TABLE "A" RENAME TO "B";')).toBe(false);
    });
});

describe("planFromScript", () => {
    it("applies the four additive operations and skips the drop", () => {
        const plan = planFromScript(SCRIPT);
        expect(plan.apply.map((s) => s.operation)).toEqual([
            "CreateEnum", "CreateTable", "CreateIndex", "AddForeignKey",
        ]);
        expect(plan.skip.map((s) => s.operation)).toEqual(["DropTable"]);
    });

    it("never applies a DropTable — the case that broke uninstall's promise", () => {
        const plan = planFromScript(`-- DropTable\nDROP TABLE "BlogArticle";\n`);
        expect(plan.apply).toEqual([]);
        expect(plan.skip).toHaveLength(1);
    });

    it("applies an additive AlterTable but not a destructive one", () => {
        const plan = planFromScript(
            `-- AlterTable\nALTER TABLE "A" ADD COLUMN "b" TEXT;\n\n-- AlterTable\nALTER TABLE "C" DROP COLUMN "d";\n`,
        );
        expect(plan.apply).toHaveLength(1);
        expect(plan.apply[0]?.sql).toContain("ADD COLUMN");
        expect(plan.skip).toHaveLength(1);
        expect(plan.skip[0]?.sql).toContain("DROP COLUMN");
    });

    it("skips an operation it does not recognise rather than guessing", () => {
        const plan = planFromScript(`-- SomeFutureOperation\nDO SOMETHING;\n`);
        expect(plan.apply).toEqual([]);
        expect(plan.skip.map((s) => s.operation)).toEqual(["SomeFutureOperation"]);
    });

    it("plans nothing when the database already matches", () => {
        expect(planFromScript("Loaded Prisma config from prisma.config.ts.\n")).toEqual({ apply: [], skip: [] });
    });
});
