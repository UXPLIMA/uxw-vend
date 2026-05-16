import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

export async function GET(request: NextRequest) {
    const period = Math.min(
        365,
        Math.max(1, parseInt(request.nextUrl.searchParams.get("period") || "30", 10) || 30),
    );

    const tickets = await prisma.ticket.count();
    const openTickets = await prisma.ticket.findMany({
        take: 5,
        where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REPLY"] } },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { username: true } }, department: { select: { name: true } } },
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    startDate.setHours(0, 0, 0, 0);

    const created = await prisma.ticket.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
    });

    const labels: string[] = [];
    const byDay: Record<string, number> = {};
    for (let i = 0; i <= period; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split("T")[0];
        labels.push(key);
        byDay[key] = 0;
    }
    for (const row of created) {
        const key = row.createdAt.toISOString().split("T")[0];
        if (key in byDay) byDay[key] += 1;
    }

    return NextResponse.json({
        stats: { tickets },
        charts: [
            {
                id: "tickets-opened",
                label: "Tickets opened per day",
                labelKey: "analytics_ticketsPerDay",
                labels,
                data: labels.map((k) => byDay[k]),
                color: "#ef4444",
            },
        ],
        sections: [{
            id: "open-tickets",
            title: "Open Tickets",
            titleKey: "dashboard_openTickets",
            viewAllHref: "/admin/tickets",
            items: openTickets.map(t => ({
                id: t.id,
                href: "/admin/tickets/" + t.id,
                primary: t.subject,
                secondary: (t.user?.username ?? "Deleted user") + " · " + (t.department?.name || ""),
                badge: t.status,
                badgeColor: "blue",
            }))
        }]
    });
}
