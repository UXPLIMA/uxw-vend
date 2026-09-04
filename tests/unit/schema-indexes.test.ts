import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "../..");

/**
 * The schema indexed the wrong columns.
 *
 * Two rules, both of which the schema already stated in one place and broke in
 * forty others. `IpBlock` carries the comment "No @@index([ip]) - `@unique`
 * already creates a B-tree on `ip`", and it was the only model that held to
 * it: thirty-four other indexes duplicated a unique constraint they could
 * never beat, paying for a second B-tree on every insert, update and delete
 * for nothing.
 *
 * The mirror of that was twelve foreign keys with no index at all. Postgres
 * does not index a foreign key for you, and a referential action has to find
 * the referencing rows: deleting one user meant a sequential scan of Account,
 * ForumTopicLike, ForumPostLike, StaffMember, TicketMessage, GiftCode and both
 * theme tables, and deleting a product meant OrderItem, CartItem and
 * Subscription. Confirmed against the running demo, where
 * `EXPLAIN SELECT * FROM "Account" WHERE "userId" = ...` planned a Seq Scan.
 */

interface Model {
    file: string;
    name: string;
    /** Column lists that are unique, longest-prefix-usable first. */
    uniques: string[][];
    indexes: string[][];
    foreignKeys: string[];
}

/** Prisma comments say what a model does; they are not declarations. */
function stripComments(source: string): string {
    return source.replace(/^\s*\/\/.*$/gm, "");
}

function parse(file: string): Model[] {
    const source = stripComments(fs.readFileSync(path.join(root, file), "utf8"));
    const models: Model[] = [];
    for (const match of source.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
        const [, name, body] = match;
        const uniques: string[][] = [];
        for (const line of body.split("\n")) {
            const inline = line.match(/^\s*(\w+)\s+\S+.*@(unique|id)\b/);
            if (inline) uniques.push([inline[1]]);
        }
        for (const u of body.matchAll(/@@(unique|id)\(\[([^\]]*)\]/g)) {
            uniques.push(u[2].split(",").map((c) => c.trim()));
        }
        const indexes = [...body.matchAll(/@@index\(\[([^\]]*)\]/g)].map((m) =>
            m[1].split(",").map((c) => c.trim()),
        );
        const foreignKeys: string[] = [];
        for (const r of body.matchAll(/@relation\([^)]*fields:\s*\[([^\]]+)\]/g)) {
            for (const raw of r[1].split(",")) foreignKeys.push(raw.trim());
        }
        models.push({ file, name, uniques, indexes, foreignKeys });
    }
    return models;
}

const schemaFiles = [
    "prisma/schema.core.prisma",
    ...fs
        .readdirSync(path.join(root, "module-sources"), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => `module-sources/${e.name}/schema.prisma`)
        .filter((f) => fs.existsSync(path.join(root, f))),
];

const models = schemaFiles.flatMap(parse);

/** A B-tree on `columns` answers any query that leads with `prefix`. */
function leadsWith(columns: string[], prefix: string[]): boolean {
    return columns.length >= prefix.length && prefix.every((c, i) => columns[i] === c);
}

describe("the schemas", () => {
    it("were all found and parsed", () => {
        expect(schemaFiles.length).toBeGreaterThan(20);
        expect(models.length).toBeGreaterThan(80);
        expect(models.find((m) => m.name === "User")).toBeDefined();
    });
});

describe("every foreign key", () => {
    it("has an index that leads with it", () => {
        const unindexed: string[] = [];
        for (const model of models) {
            for (const fk of model.foreignKeys) {
                const answered = [...model.uniques, ...model.indexes].some((cols) =>
                    leadsWith(cols, [fk]),
                );
                if (!answered) unindexed.push(`${model.file} ${model.name}.${fk}`);
            }
        }
        expect(unindexed).toEqual([]);
    });

    it("is a rule with something to check", () => {
        const total = models.reduce((n, m) => n + m.foreignKeys.length, 0);
        expect(total).toBeGreaterThan(50);
    });
});

describe("no index", () => {
    it("duplicates a unique constraint", () => {
        const redundant: string[] = [];
        for (const model of models) {
            for (const index of model.indexes) {
                const covering = model.uniques.find((u) => leadsWith(u, index));
                if (covering) {
                    redundant.push(
                        `${model.file} ${model.name}: @@index([${index}]) under unique([${covering}])`,
                    );
                }
            }
        }
        expect(redundant).toEqual([]);
    });

    it("is the prefix of another index on the same model", () => {
        const redundant: string[] = [];
        for (const model of models) {
            for (const index of model.indexes) {
                const longer = model.indexes.find(
                    (other) => other.length > index.length && leadsWith(other, index),
                );
                if (longer) {
                    redundant.push(
                        `${model.file} ${model.name}: @@index([${index}]) under @@index([${longer}])`,
                    );
                }
            }
        }
        expect(redundant).toEqual([]);
    });
});
