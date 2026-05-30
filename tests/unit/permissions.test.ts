// @vitest-environment node
/**
 * Unit tests for src/core/lib/permissions.ts — the authorization gate for the
 * entire admin surface. Tested as a REAL subject (the functions run unmodified);
 * only the Prisma client is mocked, the same way api-key-auth.test.ts does it.
 *
 * Coverage:
 *   - hasPermission: role has perm / lacks perm / admin wildcard bypass /
 *     no user / no role
 *   - hasAnyPermission / hasAllPermissions: positive, negative, admin bypass
 *   - getUserPermissions: aggregation + admin "*" + empty when no role
 *   - hasResourcePermission: admin bypass, no-grants deny, most-specific-wins
 *     precedence (user+id > user > role+id > role), deny short-circuit, wildcard
 *     action match
 *   - isAdmin / isStaff: sessionRole fast path + DB fallback
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma — only the methods permissions.ts touches.
const mockUserFindUnique = vi.fn();
const mockResourceFindMany = vi.fn();

vi.mock("@/core/lib/db", () => ({
    prisma: {
        user: {
            findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
        },
        resourcePermission: {
            findMany: (...args: unknown[]) => mockResourceFindMany(...args),
        },
    },
}));

import {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getUserPermissions,
    hasResourcePermission,
    isAdmin,
    isStaff,
} from "@/core/lib/permissions";

// Helpers to build the user-with-role shape that the include returns.
function memberWith(perms: string[], opts: { priority?: number; roleId?: string } = {}) {
    return {
        id: "u1",
        role: {
            id: opts.roleId ?? "role-member",
            name: "member",
            priority: opts.priority ?? 0,
            permissions: perms.map((name) => ({ name })),
        },
    };
}

function adminUser() {
    return {
        id: "admin1",
        role: { id: "role-admin", name: "admin", priority: 100, permissions: [] },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("hasPermission", () => {
    it("returns true when the role carries the permission", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith(["blog.manage", "store.view"]));
        expect(await hasPermission("u1", "blog.manage")).toBe(true);
    });

    it("returns false when the role lacks the permission", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith(["store.view"]));
        expect(await hasPermission("u1", "blog.manage")).toBe(false);
    });

    it("admin role bypasses the permission list entirely", async () => {
        mockUserFindUnique.mockResolvedValue(adminUser());
        expect(await hasPermission("admin1", "anything.at.all")).toBe(true);
    });

    it("returns false when the user does not exist", async () => {
        mockUserFindUnique.mockResolvedValue(null);
        expect(await hasPermission("ghost", "blog.manage")).toBe(false);
    });

    it("returns false when the user has no role", async () => {
        mockUserFindUnique.mockResolvedValue({ id: "u1", role: null });
        expect(await hasPermission("u1", "blog.manage")).toBe(false);
    });
});

describe("hasAnyPermission", () => {
    it("true when at least one listed permission is held", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith(["store.view"]));
        expect(await hasAnyPermission("u1", ["blog.manage", "store.view"])).toBe(true);
    });

    it("false when none of the listed permissions are held", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith(["forum.post"]));
        expect(await hasAnyPermission("u1", ["blog.manage", "store.view"])).toBe(false);
    });

    it("admin bypasses", async () => {
        mockUserFindUnique.mockResolvedValue(adminUser());
        expect(await hasAnyPermission("admin1", ["nope.one", "nope.two"])).toBe(true);
    });

    it("false when no role", async () => {
        mockUserFindUnique.mockResolvedValue({ id: "u1", role: null });
        expect(await hasAnyPermission("u1", ["blog.manage"])).toBe(false);
    });
});

describe("hasAllPermissions", () => {
    it("true only when every listed permission is held", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith(["a.x", "b.y", "c.z"]));
        expect(await hasAllPermissions("u1", ["a.x", "b.y"])).toBe(true);
    });

    it("false when one of the listed permissions is missing", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith(["a.x"]));
        expect(await hasAllPermissions("u1", ["a.x", "b.y"])).toBe(false);
    });

    it("admin bypasses", async () => {
        mockUserFindUnique.mockResolvedValue(adminUser());
        expect(await hasAllPermissions("admin1", ["a.x", "b.y", "c.z"])).toBe(true);
    });

    it("false when no user", async () => {
        mockUserFindUnique.mockResolvedValue(null);
        expect(await hasAllPermissions("u1", ["a.x"])).toBe(false);
    });
});

describe("getUserPermissions", () => {
    it("aggregates the role's permission names", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith(["blog.manage", "store.view"]));
        const perms = await getUserPermissions("u1");
        expect(perms).toEqual(["blog.manage", "store.view"]);
    });

    it("returns ['*'] for admin", async () => {
        mockUserFindUnique.mockResolvedValue(adminUser());
        expect(await getUserPermissions("admin1")).toEqual(["*"]);
    });

    it("returns [] when user has no role", async () => {
        mockUserFindUnique.mockResolvedValue({ id: "u1", role: null });
        expect(await getUserPermissions("u1")).toEqual([]);
    });

    it("returns [] when user is missing", async () => {
        mockUserFindUnique.mockResolvedValue(null);
        expect(await getUserPermissions("ghost")).toEqual([]);
    });
});

describe("hasResourcePermission", () => {
    it("admin bypasses without touching grants", async () => {
        mockUserFindUnique.mockResolvedValue(adminUser());
        expect(await hasResourcePermission("admin1", "blog.article", "edit", "art-1")).toBe(true);
        expect(mockResourceFindMany).not.toHaveBeenCalled();
    });

    it("denies when no grants exist at all", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith([], { roleId: "role-member" }));
        mockResourceFindMany.mockResolvedValue([]);
        expect(await hasResourcePermission("u1", "blog.article", "edit")).toBe(false);
    });

    it("denies when user/role has no role", async () => {
        mockUserFindUnique.mockResolvedValue({ id: "u1", role: null });
        expect(await hasResourcePermission("u1", "blog.article", "edit")).toBe(false);
        expect(mockResourceFindMany).not.toHaveBeenCalled();
    });

    it("allows via a role-wide grant", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith([], { roleId: "role-member" }));
        mockResourceFindMany.mockResolvedValue([
            { principalType: "role", principalId: "role-member", resourceId: null, allow: true },
        ]);
        expect(await hasResourcePermission("u1", "blog.article", "edit")).toBe(true);
    });

    it("most-specific-wins: user+resourceId allow beats a role-wide deny", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith([], { roleId: "role-member" }));
        mockResourceFindMany.mockResolvedValue([
            { principalType: "role", principalId: "role-member", resourceId: null, allow: false },
            { principalType: "user", principalId: "u1", resourceId: "art-7", allow: true },
        ]);
        expect(await hasResourcePermission("u1", "blog.article", "edit", "art-7")).toBe(true);
    });

    it("most-specific-wins: a user+resourceId deny short-circuits over a broader user allow", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith([], { roleId: "role-member" }));
        mockResourceFindMany.mockResolvedValue([
            { principalType: "user", principalId: "u1", resourceId: null, allow: true },
            { principalType: "user", principalId: "u1", resourceId: "art-7", allow: false },
        ]);
        expect(await hasResourcePermission("u1", "blog.article", "edit", "art-7")).toBe(false);
    });

    it("falls back to role-wide when no user-level or resource-scoped grant matches", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith([], { roleId: "role-member" }));
        mockResourceFindMany.mockResolvedValue([
            { principalType: "role", principalId: "role-member", resourceId: null, allow: true },
        ]);
        // resourceId supplied but only a role-wide grant exists -> still allows.
        expect(await hasResourcePermission("u1", "blog.article", "view", "art-9")).toBe(true);
    });

    it("a wildcard-action grant (action '*') satisfies a specific action request", async () => {
        mockUserFindUnique.mockResolvedValue(memberWith([], { roleId: "role-member" }));
        // The route asks findMany for action in [action, "*"]; a "*" grant comes
        // back and matches the candidate resolution.
        mockResourceFindMany.mockResolvedValue([
            { principalType: "user", principalId: "u1", resourceId: null, allow: true },
        ]);
        expect(await hasResourcePermission("u1", "blog.article", "delete")).toBe(true);
        // Confirm the query asked for both the action and the wildcard.
        const whereArg = mockResourceFindMany.mock.calls[0][0].where;
        expect(whereArg.action).toEqual({ in: ["delete", "*"] });
    });
});

describe("isAdmin", () => {
    it("sessionRole=admin short-circuits without a DB hit", async () => {
        expect(await isAdmin("u1", "admin")).toBe(true);
        expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it("falls back to DB and returns true for an admin role", async () => {
        mockUserFindUnique.mockResolvedValue({ role: { name: "admin" } });
        expect(await isAdmin("u1")).toBe(true);
    });

    it("returns false for a non-admin role via DB", async () => {
        mockUserFindUnique.mockResolvedValue({ role: { name: "member" } });
        expect(await isAdmin("u1")).toBe(false);
    });

    it("returns false when user is missing", async () => {
        mockUserFindUnique.mockResolvedValue(null);
        expect(await isAdmin("ghost")).toBe(false);
    });
});

describe("isStaff", () => {
    it("sessionRole=admin short-circuits true", async () => {
        expect(await isStaff("u1", "admin")).toBe(true);
        expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it("sessionRole=moderator short-circuits true", async () => {
        expect(await isStaff("u1", "moderator")).toBe(true);
        expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it("DB fallback: priority >= 50 is staff", async () => {
        mockUserFindUnique.mockResolvedValue({ role: { priority: 50 } });
        expect(await isStaff("u1")).toBe(true);
    });

    it("DB fallback: priority < 50 is not staff", async () => {
        mockUserFindUnique.mockResolvedValue({ role: { priority: 10 } });
        expect(await isStaff("u1")).toBe(false);
    });

    it("returns false when user has no role", async () => {
        mockUserFindUnique.mockResolvedValue({ role: null });
        expect(await isStaff("u1")).toBe(false);
    });
});
