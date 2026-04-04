import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/admin/search?q=...
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const q = request.nextUrl.searchParams.get("q") || "";
    if (q.length < 2) return NextResponse.json({ results: [] });

    const users = await prisma.user.findMany({
        where: { OR: [
            { username: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
        ]},
        select: { id: true, username: true, email: true },
        take: 5,
    });

    let products: { id: string; name: string; slug: string }[] = [];
    try {
        products = await prisma.product.findMany({
            where: { name: { contains: q, mode: "insensitive" } },
            select: { id: true, name: true, slug: true },
            take: 5,
        });
    } catch { /* model unavailable */ }

    let orders: { id: string; orderNumber: string; status: string }[] = [];
    try {
        orders = await prisma.order.findMany({
            where: { orderNumber: { contains: q, mode: "insensitive" } },
            select: { id: true, orderNumber: true, status: true },
            take: 5,
        });
    } catch { /* model unavailable */ }

    let tickets: { id: string; subject: string; status: string }[] = [];
    try {
        tickets = await prisma.ticket.findMany({
            where: { subject: { contains: q, mode: "insensitive" } },
            select: { id: true, subject: true, status: true },
            take: 5,
        });
    } catch { /* model unavailable */ }

    const results = [
        ...users.map((u) => ({ type: "user", id: u.id, title: u.username, subtitle: u.email, href: `/admin/users/${u.id}` })),
        ...products.map((p) => ({ type: "product", id: p.id, title: p.name, subtitle: p.slug, href: `/admin/store/products/${p.id}/edit` })),
        ...orders.map((o) => ({ type: "order", id: o.id, title: o.orderNumber, subtitle: o.status, href: `/admin/store/orders/${o.id}` })),
        ...tickets.map((t) => ({ type: "ticket", id: t.id, title: t.subject, subtitle: t.status, href: `/admin/tickets/${t.id}` })),
    ];

    return NextResponse.json({ results });
}
