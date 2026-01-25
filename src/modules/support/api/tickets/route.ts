import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { ticketSchema } from "@/core/lib/validations";

// GET /api/v1/tickets - List tickets
export async function GET(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const departmentId = searchParams.get("departmentId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const adminCheck = await isAdmin(session.user.id);

    // Build where clause
    const where: Record<string, unknown> = {};

    // Non-admin users can only see their own tickets
    if (!adminCheck) {
        where.userId = session.user.id;
    }

    if (status) {
        where.status = status;
    }

    if (departmentId) {
        where.departmentId = departmentId;
    }

    const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
            where,
            skip,
            take: limit,
            orderBy: { updatedAt: "desc" },
            include: {
                department: { select: { id: true, name: true, color: true } },
                user: { select: { id: true, username: true, avatar: true } },
                assignedTo: { select: { id: true, username: true, avatar: true } },
                _count: { select: { messages: true } },
            },
        }),
        prisma.ticket.count({ where }),
    ]);

    return NextResponse.json({
        tickets,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}

// POST /api/v1/tickets - Create a new ticket
export async function POST(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = ticketSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: "Validation failed", details: validation.error.flatten() },
            { status: 400 }
        );
    }

    const { subject, message, departmentId, priority } = validation.data;

    // Verify department exists
    const department = await prisma.ticketDepartment.findUnique({
        where: { id: departmentId },
    });

    if (!department) {
        return NextResponse.json(
            { error: "Department not found" },
            { status: 404 }
        );
    }

    // Create ticket with initial message
    const ticket = await prisma.ticket.create({
        data: {
            subject,
            priority: priority || "MEDIUM",
            departmentId,
            userId: session.user.id,
            messages: {
                create: {
                    content: message,
                    userId: session.user.id,
                    isStaffReply: false,
                },
            },
        },
        include: {
            department: { select: { id: true, name: true, color: true } },
            user: { select: { id: true, username: true, avatar: true } },
            messages: {
                include: {
                    user: { select: { id: true, username: true, avatar: true } },
                },
            },
        },
    });

    return NextResponse.json(ticket, { status: 201 });
}
