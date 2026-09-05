import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Deleting a principal takes the rows that name it, foreign key or not.
 *
 * Almost everything belonging to a user reaches it through a Prisma relation,
 * so a cascade removes it, the erasure sweep finds it by walking the schema,
 * and the export gate can see it. Two stores do not work that way, and both
 * were missed for the same reason: nothing about them looks like a user
 * column.
 *
 * `ResourcePermission` is polymorphic. `principalType` says "role" or "user"
 * and `principalId` holds the id, with no relation to either table. So
 * `prisma.role.delete()` cascaded nothing - a deleted role's grants stayed in
 * the table, and the admin list rendered them as a bare cuid because the name
 * lookup no longer resolved - and an erased user kept every per-account grant
 * an admin had written against them.
 *
 * `Setting` holds one row per admin under the key `dashboard_layout:<userId>`.
 * The notification preferences beside it are a real table with a real
 * relation, and erasure purged those; this one it never saw.
 *
 * Neither was in the personal data export either, which is the same blind
 * spot read from the other end: the export's own gate finds a table by its
 * `@relation` to User, and these have none.
 *
 * A cuid is never reissued, so a stale grant is inert rather than a way in.
 * What was wrong is that data about a person outlived the person's erasure
 * and never appeared in what they were handed.
 */

const ROOT = process.cwd();

function read(file: string): string {
    return fs.readFileSync(path.join(ROOT, file), "utf8");
}

describe("the schema still has no key to sweep by", () => {
    it("ResourcePermission names its principal without a relation", () => {
        // If this ever gains a real foreign key, the cascade does the work
        // and principal-rows.ts is dead weight - which is worth knowing.
        const schema = read("prisma/schema.core.prisma");
        const model = /model ResourcePermission \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
        expect(model).toContain("principalType");
        expect(model).toContain("principalId");
        expect(model).not.toContain("@relation");
    });

    it("the dashboard layout is still a Setting key, not a table", () => {
        expect(read("src/core/lib/dashboard-layout.ts")).toContain('SETTING_KEY_PREFIX = "dashboard_layout:"');
    });
});

describe("purgeUserPrincipalRows", () => {
    const deleteMany = vi.fn();

    beforeEach(() => {
        vi.resetModules();
        deleteMany.mockReset().mockResolvedValue({ count: 1 });
    });

    async function load() {
        vi.doMock("@/core/lib/db", () => ({
            prisma: {
                resourcePermission: { deleteMany },
                setting: { deleteMany },
            },
        }));
        return import("@/core/lib/principal-rows");
    }

    it("takes the user's grants and their dashboard row", async () => {
        const { purgeUserPrincipalRows } = await load();

        const removed = await purgeUserPrincipalRows("usr_1");

        expect(deleteMany).toHaveBeenCalledWith({
            where: { principalType: "user", principalId: "usr_1" },
        });
        expect(deleteMany).toHaveBeenCalledWith({
            where: { key: "dashboard_layout:usr_1" },
        });
        expect(removed).toBe(2);
    });

    it("leaves a role's grants alone", async () => {
        const { purgeUserPrincipalRows } = await load();

        await purgeUserPrincipalRows("usr_1");

        for (const call of deleteMany.mock.calls) {
            expect(call[0].where.principalType).not.toBe("role");
        }
    });

    it("takes only the named role's grants", async () => {
        const { purgeRolePrincipalRows } = await load();

        await purgeRolePrincipalRows("role_1");

        expect(deleteMany).toHaveBeenCalledWith({
            where: { principalType: "role", principalId: "role_1" },
        });
    });

    it("survives a database that refuses, because the erasure matters more", async () => {
        vi.resetModules();
        vi.doMock("@/core/lib/db", () => ({
            prisma: {
                resourcePermission: { deleteMany: vi.fn().mockRejectedValue(new Error("down")) },
                setting: { deleteMany: vi.fn().mockRejectedValue(new Error("down")) },
            },
        }));
        const { purgeUserPrincipalRows, purgeRolePrincipalRows } = await import("@/core/lib/principal-rows");

        await expect(purgeUserPrincipalRows("usr_1")).resolves.toBe(0);
        await expect(purgeRolePrincipalRows("role_1")).resolves.toBe(0);
    });
});

describe("the delete paths call it", () => {
    it("erasing a user sweeps the unrelated rows", () => {
        const src = read("src/core/lib/user-deletion.ts");
        expect(src).toContain("purgeUserPrincipalRows");
        // After the relation-backed purge, so a failure there cannot skip it.
        expect(src.indexOf("purgeUserPrincipalRows(userId)")).toBeGreaterThan(
            src.indexOf("CORE_MODELS_TO_PURGE"),
        );
    });

    it("deleting a role sweeps its grants", () => {
        const src = read("src/app/api/v1/roles/[id]/route.ts");
        expect(src).toContain("purgeRolePrincipalRows(id)");
        expect(src.indexOf("purgeRolePrincipalRows(id)")).toBeGreaterThan(
            src.indexOf("prisma.role.delete"),
        );
    });

    it("the export hands back what the erasure takes away", () => {
        // Purging something the person was never shown is the other half of
        // the same bug: they cannot check what was held about them.
        const src = read("src/core/lib/user-data-export.ts");
        expect(src).toContain('key: "resourcePermissions"');
        expect(src).toContain('where: { principalType: "user" }');
        expect(src).toContain("dashboardLayoutKey(userId)");
        expect(src).toContain("dashboardLayout: layout");
    });

    it("the README names both, because it claims to name everything", () => {
        const src = read("src/core/lib/user-data-export.ts");
        const readme = src.slice(src.indexOf("buildExportReadme"));
        expect(readme).toContain("resourcePermissions");
        expect(readme).toContain("dashboardLayout");
    });
});
