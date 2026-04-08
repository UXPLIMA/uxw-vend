import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin, setResourcePermission, removeResourcePermission, listGrantsForRole } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { logActivity } from "@/core/lib/activity-log";

/** GET
 *  - ?roleId=xxx → list all grants for a single role
 *  - ?list=1 → full paginated grants list for admin viewer (both role + user principals)
 *  - (no params) → returns { roles, grants } for matrix UI
 *
 *  Extra filters when list=1: ?resource=...&principalType=role|user&page=1
 */
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get("roleId");

    if (roleId) {
        const grants = await listGrantsForRole(roleId);
        return NextResponse.json({ grants });
    }

    if (searchParams.get("list") === "1") {
        const resource = searchParams.get("resource") || undefined;
        const principalType = searchParams.get("principalType") || undefined;
        const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
        const perPage = 50;

        const where = {
            ...(resource ? { resource } : {}),
            ...(principalType === "role" || principalType === "user"
                ? { principalType }
                : {}),
        };

        const [grantsRaw, total, roles] = await Promise.all([
            prisma.resourcePermission.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.resourcePermission.count({ where }),
            prisma.role.findMany({
                orderBy: { priority: "desc" },
                select: { id: true, name: true, displayName: true, color: true },
            }),
        ]);

        // Resolve principal display names in a single pass.
        const roleIds = grantsRaw
            .filter((g) => g.principalType === "role")
            .map((g) => g.principalId);
        const userIds = grantsRaw
            .filter((g) => g.principalType === "user")
            .map((g) => g.principalId);

        const [roleMap, userMap] = await Promise.all([
            roleIds.length
                ? prisma.role
                      .findMany({
                          where: { id: { in: roleIds } },
                          select: { id: true, displayName: true, name: true },
                      })
                      .then((rs) =>
                          Object.fromEntries(rs.map((r) => [r.id, r.displayName || r.name])),
                      )
                : Promise.resolve({} as Record<string, string>),
            userIds.length
                ? prisma.user
                      .findMany({
                          where: { id: { in: userIds } },
                          select: { id: true, username: true },
                      })
                      .then((us) => Object.fromEntries(us.map((u) => [u.id, u.username])))
                : Promise.resolve({} as Record<string, string>),
        ]);

        const grants = grantsRaw.map((g) => ({
            ...g,
            principalLabel:
                g.principalType === "role"
                    ? roleMap[g.principalId] || g.principalId
                    : userMap[g.principalId] || g.principalId,
        }));

        return NextResponse.json({
            grants,
            total,
            page,
            pages: Math.max(1, Math.ceil(total / perPage)),
            roles,
        });
    }

    // Return all roles + all distinct resources for the matrix UI
    const roles = await prisma.role.findMany({ orderBy: { priority: "desc" } });
    const allGrants = await prisma.resourcePermission.findMany({
        where: { principalType: "role" },
    });
    return NextResponse.json({ roles, grants: allGrants });
}

const setSchema = z.object({
    resource: z.string().min(1),
    resourceId: z.string().nullable().optional(),
    action: z.string().min(1),
    principalType: z.enum(["role", "user"]),
    principalId: z.string().min(1),
    allow: z.boolean(),
});

/** POST → upsert a grant */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = setSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });
    }

    await setResourcePermission(parsed.data);

    logActivity({
        userId: session.user.id,
        action: "permission.grant",
        entity: parsed.data.resource,
        entityId: parsed.data.resourceId ?? undefined,
        metadata: {
            resource: parsed.data.resource,
            resourceId: parsed.data.resourceId ?? null,
            action: parsed.data.action,
            principalType: parsed.data.principalType,
            principalId: parsed.data.principalId,
            allow: parsed.data.allow,
        },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
}

const deleteSchema = setSchema.omit({ allow: true });

/** DELETE → remove a grant */
export async function DELETE(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });
    }

    await removeResourcePermission(parsed.data);

    logActivity({
        userId: session.user.id,
        action: "permission.revoke",
        entity: parsed.data.resource,
        entityId: parsed.data.resourceId ?? undefined,
        metadata: {
            resource: parsed.data.resource,
            resourceId: parsed.data.resourceId ?? null,
            action: parsed.data.action,
            principalType: parsed.data.principalType,
            principalId: parsed.data.principalId,
        },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
}
