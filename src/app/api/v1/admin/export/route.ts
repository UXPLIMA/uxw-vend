import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/admin/export?type=products|orders|users
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const type = request.nextUrl.searchParams.get("type") || "products";

    let csv = "";

    switch (type) {
        case "products": {
            try {
                const products = await prisma.product.findMany({
                    include: { category: { select: { name: true } } },
                });
                csv = "id,name,slug,price,comparePrice,stock,category,isActive,isFeatured,type,createdAt\n";
                csv += products.map((p) =>
                    `"${p.id}","${p.name}","${p.slug}",${p.price},${p.comparePrice || ""},${p.stock ?? ""},` +
                    `"${p.category?.name || ""}",${p.isActive},${p.isFeatured},"${p.type}","${p.createdAt.toISOString()}"`
                ).join("\n");
            } catch {
                return NextResponse.json({ error: "No data available" }, { status: 400 });
            }
            break;
        }
        case "orders": {
            try {
                const orders = await prisma.order.findMany({
                    include: { user: { select: { username: true, email: true } } },
                });
                csv = "id,orderNumber,username,email,subtotal,discount,total,status,paymentMethod,createdAt\n";
                csv += orders.map((o) =>
                    `"${o.id}","${o.orderNumber}","${o.user.username}","${o.user.email}",` +
                    `${o.subtotal},${o.discount},${o.total},"${o.status}","${o.paymentMethod || ""}","${o.createdAt.toISOString()}"`
                ).join("\n");
            } catch {
                return NextResponse.json({ error: "No data available" }, { status: 400 });
            }
            break;
        }
        case "users": {
            const users = await prisma.user.findMany({
                include: { role: { select: { name: true } } },
            });
            csv = "id,username,email,role,isBanned,creditBalance,createdAt\n";
            csv += users.map((u) =>
                `"${u.id}","${u.username}","${u.email}","${u.role?.name || ""}",` +
                `${u.isBanned},${u.creditBalance},"${u.createdAt.toISOString()}"`
            ).join("\n");
            break;
        }
        default:
            return NextResponse.json({ error: "Invalid type. Use: products, orders, users" }, { status: 400 });
    }

    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${type}-export-${Date.now()}.csv"`,
        },
    });
}
