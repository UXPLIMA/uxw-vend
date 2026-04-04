import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { ticketMessageSchema, ticketUpdateSchema } from "@/core/lib/validations";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/v1/tickets/[id] - Get ticket details
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: {
            department: { select: { id: true, name: true, color: true } },
            user: { select: { id: true, username: true, avatar: true } },
            assignedTo: { select: { id: true, username: true, avatar: true } },
            messages: {
                orderBy: { createdAt: "asc" },
                include: {
                    user: { select: { id: true, username: true, avatar: true } },
                },
            },
        },
    });

    if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Check access - user can see own tickets, admin can see all
    const adminCheck = await isAdmin(session.user.id);
    if (ticket.userId !== session.user.id && !adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(ticket);
}

// POST /api/v1/tickets/[id] - Add a message/reply to ticket
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await prisma.ticket.findUnique({
        where: { id },
    });

    if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Check access
    const adminCheck = await isAdmin(session.user.id);
    if (ticket.userId !== session.user.id && !adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = ticketMessageSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: "Validation failed", details: validation.error.flatten() },
            { status: 400 }
        );
    }

    const { content } = validation.data;

    // Create message and update ticket status
    const isStaffReply = adminCheck && ticket.userId !== session.user.id;

    const message = await prisma.ticketMessage.create({
        data: {
            content,
            ticketId: id,
            userId: session.user.id,
            isStaffReply,
        },
        include: {
            user: { select: { id: true, username: true, avatar: true } },
        },
    });

    // Update ticket status and timestamp
    await prisma.ticket.update({
        where: { id },
        data: {
            status: isStaffReply ? "WAITING_REPLY" : "OPEN",
            updatedAt: new Date(),
        },
    });

    return NextResponse.json(message, { status: 201 });
}

// PATCH /api/v1/tickets/[id] - Update ticket (admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ticket = await prisma.ticket.findUnique({
        where: { id },
    });

    if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = ticketUpdateSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json(
            { error: "Validation failed", details: validation.error.flatten() },
            { status: 400 }
        );
    }

    const updateData: Record<string, unknown> = {};
    if (validation.data.status) updateData.status = validation.data.status;
    if (validation.data.priority) updateData.priority = validation.data.priority;
    if (validation.data.assignedToId !== undefined) {
        updateData.assignedToId = validation.data.assignedToId;
    }

    // Set closedAt if closing the ticket
    if (validation.data.status === "CLOSED" || validation.data.status === "RESOLVED") {
        updateData.closedAt = new Date();
    }

    const updated = await prisma.ticket.update({
        where: { id },
        data: updateData,
        include: {
            department: { select: { id: true, name: true, color: true } },
            user: { select: { id: true, username: true, avatar: true } },
            assignedTo: { select: { id: true, username: true, avatar: true } },
        },
    });

    return NextResponse.json(updated);
}
