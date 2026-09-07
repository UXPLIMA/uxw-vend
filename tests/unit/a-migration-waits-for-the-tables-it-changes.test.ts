import { describe, it, expect } from "vitest";
import { declaredModels, hasBeenReconciled } from "../../scripts/apply-migrations";

/**
 * Installing a module runs its migrations before its tables exist.
 *
 * Install copies the files, merges the module's `schema.prisma` into the core
 * one, and the database is reconciled from that merged schema on the build
 * that follows. The migration runner goes first. On an install into an empty
 * database every table a migration names is still missing, so Postgres
 * answers `42P01 relation "BlogComment" does not exist`, the runner records an
 * error, and the installer calls the install failed.
 *
 * CI's Docker lifecycle job installs `blog` into an empty volume and had been
 * failing on exactly that for five commits while every local gate stayed
 * green, because no local gate installs a module into an empty database.
 *
 * The migrations are not wrong. All six in the tree fail this way and each is
 * correct for the database it was written for: an older one that already has
 * the table. What is wrong is running them before there is anything to
 * migrate.
 *
 * Editing them is not the fix either. The runner stores a checksum and aborts
 * a module whose applied migration has changed on disk, which is the right
 * rule: it would turn a fix here into a broken upgrade everywhere the old
 * text had already run.
 *
 * So the runner waits. A module whose own tables are all still missing has
 * not been reconciled yet, and its migrations are left unapplied and
 * unrecorded for the pass that follows the reconcile.
 */

describe("the models a module declares", () => {
    it("are the ones its own schema names", () => {
        const schema = `
model BlogArticle {
  id String @id
}

model BlogComment {
  id String @id
}
`;
        expect(declaredModels(schema)).toEqual(["BlogArticle", "BlogComment"]);
    });

    it("does not count a model named inside a comment", () => {
        const schema = `
// model GhostModel {
model RealModel {
  id String @id
}
`;
        expect(declaredModels(schema)).toEqual(["RealModel"]);
    });

    it("is empty for a module that ships no schema", () => {
        expect(declaredModels("")).toEqual([]);
    });
});

describe("a module whose tables are not there yet", () => {
    it("is waiting for the reconcile, so its migrations wait too", () => {
        expect(hasBeenReconciled(["BlogArticle", "BlogComment"], new Set())).toBe(false);
    });

    it("is ready once any of its tables exists", () => {
        // Partial is the upgrade case: a module that gained a model since the
        // last release has some tables and not others, and its migrations are
        // exactly what brings the rest forward.
        expect(hasBeenReconciled(["BlogArticle", "BlogComment"], new Set(["BlogArticle"]))).toBe(true);
    });

    it("is ready when it declares no tables of its own", () => {
        // A module with no schema has nothing to wait for, and may still ship
        // a migration that touches core tables.
        expect(hasBeenReconciled([], new Set())).toBe(true);
    });
});
