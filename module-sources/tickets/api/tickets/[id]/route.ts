import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { rateLimitForRole } from "@/core/lib/rate-limit";
import { ticketMessageSchema, ticketUpdateSchema } from "../../../lib/validations";
import { canAccessTicket } from "../../../lib/can-access-ticket";

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

    // Check access — owner, tickets.manage role perm, or granular view grant.
    if (!(await canAccessTicket(session.user.id, id, "view"))) {
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

    const rl = await rateLimitForRole(
        `ticket-reply:${session.user.id}`,
        { maxRequests: 10, windowMs: 60_000 },
        session.user.role
    );
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const ticket = await prisma.ticket.findUnique({
        where: { id },
    });

    if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Check access — owner, tickets.manage role perm, or granular view grant
    // (granular viewers are allowed to post replies too).
    if (!(await canAccessTicket(session.user.id, id, "view"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const adminCheck = await isAdmin(session.user.id);

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

    // Update ticket status and timestamp.
    // Only adjust status when the ticket isn't already closed/resolved —
    // a reply to a RESOLVED or CLOSED ticket previously auto-reopened
    // it as OPEN, which surprised admins. Now resolved tickets stay
    // resolved unless the admin explicitly reopens via PATCH.
    const isClosed = ticket.status === "RESOLVED" || ticket.status === "CLOSED";
    await prisma.ticket.update({
        where: { id },
        data: {
            status: isClosed ? ticket.status : (isStaffReply ? "WAITING_REPLY" : "OPEN"),
            updatedAt: new Date(),
        },
    });

    // Fire hook for cross-module reactions
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("tickets.ticket.replied", { ticket, message, isStaffReply });

    // Private activity feed entry
    await prisma.activityFeedItem.create({
        data: {
            type: "tickets.ticket.replied",
            actorId: session.user.id,
            title: `Replied to ticket: ${ticket.subject}`,
            href: `/tickets/${ticket.id}`,
            icon: "Ticket",
            isPublic: false,
        },
    }).catch(() => {});

    return NextResponse.json(message, { status: 201 });
}

// PATCH /api/v1/tickets/[id] - Update ticket (admin, manage perm, granular edit)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check access — admin bypass, tickets.manage role perm, owner, or
    // granular edit grant.
    if (!(await canAccessTicket(session.user.id, id, "edit"))) {
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

    // Fire hook for cross-module reactions
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("tickets.ticket.updated", updated);

    if (validation.data.status === "CLOSED" || validation.data.status === "RESOLVED") {
        await doActionAsync("tickets.ticket.closed", updated);
    }

    return NextResponse.json(updated);
}

// DELETE /api/v1/tickets/[id] — Delete ticket (admin only).
// Cascade-deletes the ticket's messages.
export async function DELETE(_: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    await prisma.ticket.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
