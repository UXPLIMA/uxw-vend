import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { ticketSchema } from "../../lib/validations";
import { sendDiscordWebhook } from "@/core/lib/discord";
import { rateLimitForRole } from "@/core/lib/rate-limit";

// GET /api/v1/tickets - List tickets
export async function GET(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const departmentId = searchParams.get("departmentId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10") || 10));
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

    const rl = await rateLimitForRole(
        `ticket-create:${session.user.id}`,
        { maxRequests: 5, windowMs: 3_600_000 },
        session.user.role
    );
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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

    // Discord notification
    sendDiscordWebhook("ticket_created", {
        embeds: [{
            title: "New Support Ticket",
            color: 0xf59e0b,
            fields: [
                { name: "Subject", value: subject, inline: true },
                { name: "User", value: ticket.user.username, inline: true },
                { name: "Department", value: ticket.department.name, inline: true },
                { name: "Priority", value: ticket.priority, inline: true },
            ],
            timestamp: new Date().toISOString(),
        }],
    }).catch(console.error);

    // Fire hook for cross-module reactions
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("tickets.ticket.opened", ticket);

    // Private activity feed entry (only visible to actor)
    await prisma.activityFeedItem.create({
        data: {
            type: "tickets.ticket.opened",
            actorId: session.user.id,
            title: `Opened ticket: ${ticket.subject}`,
            href: `/tickets/${ticket.id}`,
            icon: "Ticket",
            isPublic: false,
        },
    }).catch(() => {});

    return NextResponse.json(ticket, { status: 201 });
}
