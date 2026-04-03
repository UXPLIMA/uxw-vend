import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { roleSchema } from "@/core/lib/validations";

// GET /api/v1/roles - List all roles
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const roles = await prisma.role.findMany({
        include: {
            permissions: true,
            _count: { select: { users: true } },
        },
        orderBy: { priority: "desc" },
    });

    return NextResponse.json({ roles });
}

// POST /api/v1/roles - Create role
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = roleSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: validation.error.issues[0].message },
            { status: 400 }
        );
    }

    const { name, displayName, color, priority, permissions } = validation.data;

    const existing = await prisma.role.findUnique({ where: { name } });
    if (existing) {
        return NextResponse.json({ error: "Role name already exists" }, { status: 400 });
    }

    const role = await prisma.role.create({
        data: {
            name,
            displayName,
            color,
            priority: priority || 0,
            permissions: permissions?.length
                ? {
                    connectOrCreate: permissions.map((perm) => ({
                        where: { name: perm },
                        create: { name: perm, module: perm.split(".")[0], description: perm },
                    })),
                }
                : undefined,
        },
        include: { permissions: true, _count: { select: { users: true } } },
    });

    return NextResponse.json({ role }, { status: 201 });
}
