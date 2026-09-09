import { NextResponse } from "next/server";
import { auth } from "@/core/sdk/auth";
import { isAdmin, prisma } from "@/core/sdk/server";

/**
 * GET /api/v1/parasut-invoicing/issue - the sales this module could not invoice.
 *
 * An operator installed this because they are obliged to issue invoices, so
 * the orders that failed are the ones they need to see. Reading the list is
 * all this does: a retry happens on the order's next completion, which is the
 * one path that holds the claim.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const failures = await prisma.issuedInvoice.findMany({
        where: { status: "failed" },
        orderBy: { updatedAt: "desc" },
        take: 100,
    });

    return NextResponse.json({ failures }, { headers: { "Cache-Control": "private, no-store" } });
}
