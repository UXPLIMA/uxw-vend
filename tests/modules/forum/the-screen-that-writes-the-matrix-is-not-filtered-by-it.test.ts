// @vitest-environment node
/**
 * The grid an operator fixes a permission mistake in cannot be subject to the
 * mistake.
 *
 * `/api/v1/forum/categories` narrows to what the *reader* may see, which is
 * right for the board and wrong for the screen that writes the matrix. An
 * admin whose own role is unticked for a category would find that category
 * gone from the grid, and gone is exactly where they cannot untick it back.
 * One wrong row and the category is unreachable for everybody, permanently,
 * from inside the product.
 *
 * So the editor reads through its own endpoint, which is admin-guarded and
 * narrowed by nothing: every category including the ones nobody may open and
 * the ones switched off, every role, and the rules as they stand.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { forumCategory, forumCategoryPermission, role, isAdmin } = vi.hoisted(() => ({
    forumCategory: { findMany: vi.fn(), findUnique: vi.fn() },
    forumCategoryPermission: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    role: { findMany: vi.fn() },
    isAdmin: vi.fn(async () => true),
}));

vi.mock("@/core/sdk/server", () => ({
    isAdmin,
    prisma: { forumCategory, forumCategoryPermission, role, $transaction: vi.fn(async () => []) },
    readJsonBody: async (request: Request) => request.json(),
}));
vi.mock("@/core/sdk/auth", () => ({ auth: async () => ({ user: { id: "admin1", role: "staff" } }) }));

import { GET } from "@/modules/forum/api/categories/permissions/route";

/** A board where "staff-only" hides the category from every other role. */
const CATEGORIES = [
    { id: "general", name: "General", parentId: null, isActive: true, order: 0 },
    { id: "staff-only", name: "Staff room", parentId: null, isActive: true, order: 1 },
    { id: "retired", name: "Archive", parentId: null, isActive: false, order: 2 },
];
const RULES = [
    { containerId: "staff-only", categoryId: "staff-only", roleId: "staff", canView: true, canPost: true, canReply: true },
];
const ROLES = [
    { id: "staff", name: "staff", displayName: "Staff", color: null, priority: 90 },
    { id: "member", name: "member", displayName: "Member", color: null, priority: 0 },
];

async function read(url = "http://localhost/api/v1/forum/categories/permissions") {
    const res = await GET(new Request(url) as never);
    return { status: res.status, body: await res.json() };
}

describe("what the permission editor is given", () => {
    beforeEach(() => {
        forumCategory.findMany.mockReset().mockResolvedValue(CATEGORIES);
        forumCategoryPermission.findMany.mockReset().mockResolvedValue(RULES);
        role.findMany.mockReset().mockResolvedValue(ROLES);
    });

    it("answers with the categories, the roles and the rules in one read", async () => {
        const { status, body } = await read();
        expect(status).toBe(200);
        expect(body.categories).toHaveLength(3);
        expect(body.roles).toHaveLength(2);
        expect(body.rules).toHaveLength(1);
    });

    it("reads every category rather than the ones this admin may open", async () => {
        await read();
        const [args] = forumCategory.findMany.mock.calls[0];
        // No `where` narrowing it at all: not by the matrix, and not by the
        // active switch either, because a category an operator turned off is
        // one they may still need to fix the permissions on.
        expect(args?.where).toBeUndefined();
    });

    it("names its columns rather than taking the row whole", async () => {
        await read();
        const [args] = forumCategory.findMany.mock.calls[0];
        expect(args?.select).toBeDefined();
        expect(Object.keys(args.select)).toContain("parentId");
    });

    it("bounds what it reads, because a board can have any number of anything", async () => {
        await read();
        expect(forumCategory.findMany.mock.calls[0][0]?.take).toBeGreaterThan(0);
        expect(role.findMany.mock.calls[0][0]?.take).toBeGreaterThan(0);
    });

    it("still narrows the rules when the screen asks about one category", async () => {
        await read("http://localhost/api/v1/forum/categories/permissions?categoryId=general");
        const [args] = forumCategoryPermission.findMany.mock.calls[0];
        expect(args.where).toEqual({ categoryId: "general" });
    });

    it("refuses somebody who is not an admin", async () => {
        isAdmin.mockResolvedValueOnce(false);
        expect((await read()).status).toBe(403);
    });
});
