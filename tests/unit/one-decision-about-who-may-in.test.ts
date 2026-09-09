/**
 * Two modules asking the same question about roles.
 *
 * The forum needed it first: which roles may open a category, with two
 * silences that mean opposite things and a tree where a child is never more
 * open than its parent. The support desk needs the same answer about its
 * departments, and the next thing with sections will need it again.
 *
 * Copying sixty lines of that into a second module is how the two drift, and
 * the lines that drift are the ones that decide who gets in. So the decision
 * lives in the SDK, named for what it is - a role, a container, a list of
 * rules - and naming no module and no kind of site.
 *
 * The modules keep their own tables. What is shared is the argument about what
 * a silence means, not where the rows are.
 */
import { describe, it, expect } from "vitest";
import { accessByRole } from "@/core/sdk";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

describe("the shared decision", () => {
    it("opens a container nobody has ruled on", () => {
        expect(accessByRole({ id: "a", parentId: null }, [], [], "member"))
            .toEqual({ view: true, post: true, reply: true });
    });

    it("shuts one whose list does not name this role", () => {
        const rules = [{ containerId: "a", roleId: "staff", canView: true, canPost: true, canReply: true }];
        expect(accessByRole({ id: "a", parentId: null }, [], rules, "member"))
            .toEqual({ view: false, post: false, reply: false });
    });

    it("never lets a child out-open its parent", () => {
        const rules = [
            { containerId: "p", roleId: "staff", canView: true, canPost: true, canReply: true },
            { containerId: "c", roleId: "member", canView: true, canPost: true, canReply: true },
        ];
        expect(accessByRole({ id: "c", parentId: "p" }, [{ id: "p", parentId: null }], rules, "member"))
            .toEqual({ view: false, post: false, reply: false });
    });
});

describe("the modules that ask it", () => {
    it("do not each keep a copy of the rules", () => {
        // The two silences and the containment rule are the security-relevant
        // lines. A module with its own copy is a module that will be fixed
        // once and left wrong once.
        const copies: string[] = [];
        for (const id of fs.readdirSync(path.join(ROOT, "module-sources"))) {
            const lib = path.join(ROOT, "module-sources", id, "lib");
            if (!fs.existsSync(lib)) continue;
            for (const file of fs.readdirSync(lib)) {
                if (!file.endsWith(".ts")) continue;
                const source = fs.readFileSync(path.join(lib, file), "utf8");
                /*
                 * A module may wrap the decision in its own words - the forum
                 * says "category" where the SDK says "container" - so long as
                 * it asks the SDK for the answer. What it may not do is work
                 * the answer out itself, and the difference between the two is
                 * whether the import is there.
                 */
                const names = /function\s+(categoryAccess|departmentAccess|accessByRole)\s*\(/;
                const asks = /from\s+["']@\/core\/sdk["']/;
                if (names.test(source) && !asks.test(source)) {
                    copies.push(`${id}/lib/${file}`);
                }
            }
        }
        expect(copies).toEqual([]);
    });
});
