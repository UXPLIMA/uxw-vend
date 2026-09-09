/**
 * Who may read, write and reply in a forum category.
 *
 * A permission matrix has two silences and they must mean opposite things,
 * which is the whole difficulty.
 *
 * A category nobody has said anything about is open. Anything else and
 * installing this switches off every category on every existing site, which
 * is a permission system arriving as an outage.
 *
 * A category where somebody has said who may, and did not say this role, is
 * shut to it. Once an operator has written a list, the list is the answer:
 * reading silence as permission there means a staff-only section that lets in
 * everyone the operator forgot to think about.
 *
 * Subcategories then make it a tree, and a tree has one rule worth more than
 * the rest: a child is never more open than its parent. A private section
 * whose children are public is the same leak with an extra click, and it is
 * the shape an operator produces by moving a category rather than by writing
 * a rule.
 */
import { describe, it, expect } from "vitest";
import { categoryAccess } from "@/modules/forum/lib/permissions";

const CLOSED = { view: false, post: false, reply: false };
const OPEN = { view: true, post: true, reply: true };

/** A rule, as an operator writes one line of the matrix. */
const rule = (categoryId: string, roleId: string, over: Partial<typeof OPEN> = {}) => ({
    categoryId,
    roleId,
    canView: true,
    canPost: true,
    canReply: true,
    ...over,
});

describe("a category nobody has ruled on", () => {
    it("is open to everybody, including somebody signed out", () => {
        expect(categoryAccess({ id: "c1", parentId: null }, [], [], "member")).toEqual(OPEN);
        expect(categoryAccess({ id: "c1", parentId: null }, [], [], null)).toEqual(OPEN);
    });
});

describe("a category with a list", () => {
    const rules = [rule("c1", "staff")];

    it("lets in the role on the list", () => {
        expect(categoryAccess({ id: "c1", parentId: null }, [], rules, "staff")).toEqual(OPEN);
    });

    it("shuts out a role that is not on it", () => {
        // The operator wrote a list. Silence in a list is a no.
        expect(categoryAccess({ id: "c1", parentId: null }, [], rules, "member")).toEqual(CLOSED);
    });

    it("shuts out somebody signed out", () => {
        expect(categoryAccess({ id: "c1", parentId: null }, [], rules, null)).toEqual(CLOSED);
    });

    it("can let a role read without letting it write", () => {
        const readOnly = [rule("c1", "member", { canPost: false, canReply: false })];
        expect(categoryAccess({ id: "c1", parentId: null }, [], readOnly, "member")).toEqual({
            view: true,
            post: false,
            reply: false,
        });
    });

    it("cannot let a role write in something it cannot read", () => {
        // Posting into a category you cannot open is not a permission, it is
        // a contradiction, and it would show a reply box on a 404.
        const odd = [rule("c1", "member", { canView: false })];
        expect(categoryAccess({ id: "c1", parentId: null }, [], odd, "member")).toEqual(CLOSED);
    });
});

describe("a subcategory", () => {
    const parent = { id: "p1", parentId: null };
    const child = { id: "c1", parentId: "p1" };

    it("inherits its parent's list when it has none of its own", () => {
        const rules = [rule("p1", "staff")];
        expect(categoryAccess(child, [parent], rules, "staff")).toEqual(OPEN);
        expect(categoryAccess(child, [parent], rules, "member")).toEqual(CLOSED);
    });

    it("is never more open than its parent", () => {
        // The shape an operator makes by moving a category rather than by
        // writing a rule: the child says yes and the parent has never heard
        // of them.
        const rules = [rule("p1", "staff"), rule("c1", "member")];
        expect(categoryAccess(child, [parent], rules, "member")).toEqual(CLOSED);
    });

    it("may be narrower than its parent", () => {
        const rules = [rule("p1", "member"), rule("c1", "staff")];
        expect(categoryAccess(child, [parent], rules, "member")).toEqual(CLOSED);
        expect(categoryAccess(child, [parent], rules, "staff")).toEqual(CLOSED);
    });

    it("is shut when any ancestor is, however deep", () => {
        const grand = { id: "g1", parentId: null };
        const mid = { id: "p1", parentId: "g1" };
        const rules = [rule("g1", "staff")];
        expect(categoryAccess(child, [mid, grand], rules, "member")).toEqual(CLOSED);
        expect(categoryAccess(child, [mid, grand], rules, "staff")).toEqual(OPEN);
    });

    it("is open when nothing in the whole line has been ruled on", () => {
        expect(categoryAccess(child, [parent], [], "member")).toEqual(OPEN);
    });
});
