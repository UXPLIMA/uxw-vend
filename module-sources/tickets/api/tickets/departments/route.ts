import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { ticketDepartmentSchema } from "../../../lib/validations";

// GET /api/v1/tickets/departments - List departments
export async function GET(request: NextRequest) {
    const session = await auth();
    const adminCheck = session?.user?.id ? await isAdmin(session.user.id) : false;

    // Admin sees all departments (including inactive), public sees only active
    const where = adminCheck ? {} : { isActive: true };

    const departments = await prisma.ticketDepartment.findMany({
        where,
        orderBy: { order: "asc" },
    });

    return NextResponse.json({ departments });
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

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = ticketDepartmentSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0].message },
            { status: 400 }
        );
    }
    const { name, description, color, order } = parsed.data;

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
