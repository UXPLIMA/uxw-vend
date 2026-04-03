import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

export async function GET() {
    const discounts = await prisma.bulkDiscount.findMany({
        where: { isActive: true },
        orderBy: { minQuantity: "asc" },
    });
    return NextResponse.json({ discounts });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name, minQuantity, discountPercent, productId, categoryId } = await request.json();
    if (!name || !minQuantity || !discountPercent) {
        return NextResponse.json({ error: "name, minQuantity, discountPercent required" }, { status: 400 });
    }

    const discount = await prisma.bulkDiscount.create({
        data: {
            name,
            minQuantity,
            discountPercent,
            productId: productId || null,
            categoryId: categoryId || null,
        },
    });
    return NextResponse.json({ discount }, { status: 201 });
}
