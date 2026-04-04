import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/tickets/departments - List departments
export async function GET() {
    const departments = await prisma.ticketDepartment.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
    });

    return NextResponse.json(departments);
}

// POST /api/v1/tickets/departments - Create department (admin)
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
    const { name, description, color, order } = body;

    if (!name) {
        return NextResponse.json(
            { error: "Name is required" },
            { status: 400 }
        );
    }

    const department = await prisma.ticketDepartment.create({
        data: {
            name,
            description,
            color,
            order: order || 0,
        },
    });

    return NextResponse.json(department, { status: 201 });
}
