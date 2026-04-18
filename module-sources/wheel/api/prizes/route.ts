import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET - List prizes (admin sees all, public sees active only)
export async function GET() {
    const session = await auth();
    const adminCheck = session?.user?.id ? await isAdmin(session.user.id) : false;

    const where = adminCheck ? {} : { isActive: true };

    const prizes = await prisma.wheelPrize.findMany({
        where,
        orderBy: { order: "asc" },
    });
    return NextResponse.json({ prizes });
}

// POST - Admin: create prize
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name, type, value, color, probability, order } = await request.json();
    if (!name || !type) return NextResponse.json({ error: "Name and type required" }, { status: 400 });

    const prize = await prisma.wheelPrize.create({
        data: {
            name,
            type,
            value: value || 0,
            color: color || "#3b82f6",
            probability: probability || 10,
            order: order || 0,
        },
    });
    return NextResponse.json({ prize }, { status: 201 });
}
