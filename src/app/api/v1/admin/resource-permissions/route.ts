import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin, setResourcePermission, removeResourcePermission, listGrantsForRole } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

/** GET ?roleId=xxx → list all grants for a role */
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
    return NextResponse.json({ ok: true });
}
