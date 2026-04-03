import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { roleSchema } from "@/core/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/v1/roles/[id] - Update role
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = roleSchema.partial().safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: validation.error.issues[0].message },
            { status: 400 }
        );
    }

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
        return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Prevent editing the admin role name
    if (existing.name === "admin" && validation.data.name && validation.data.name !== "admin") {
        return NextResponse.json({ error: "Cannot rename the admin role" }, { status: 400 });
    }

    const { permissions, ...roleData } = validation.data;

    const role = await prisma.role.update({
        where: { id },
        data: {
            ...roleData,
            permissions: permissions
                ? {
                    set: [],
                    connectOrCreate: permissions.map((perm) => ({
                        where: { name: perm },
                        create: { name: perm, module: perm.split(".")[0], description: perm },
                    })),
                }
                : undefined,
        },
        include: { permissions: true, _count: { select: { users: true } } },
    });

    return NextResponse.json({ role });
}

// DELETE /api/v1/roles/[id] - Delete role
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.role.findUnique({
        where: { id },
        include: { _count: { select: { users: true } } },
    });

    if (!existing) {
        return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (existing.name === "admin") {
        return NextResponse.json({ error: "Cannot delete the admin role" }, { status: 400 });
    }

    if (existing._count.users > 0) {
        return NextResponse.json(
            { error: `Cannot delete role with ${existing._count.users} assigned users. Reassign them first.` },
            { status: 400 }
        );
    }

    await prisma.role.delete({ where: { id } });

    return NextResponse.json({ message: "Role deleted" });
}
