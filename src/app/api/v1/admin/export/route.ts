import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/admin/export?type=users
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const type = request.nextUrl.searchParams.get("type") || "users";

    let csv = "";

    switch (type) {
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
            return NextResponse.json({ error: "Invalid type. Use: users" }, { status: 400 });
    }

    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${type}-export-${Date.now()}.csv"`,
        },
    });
}
