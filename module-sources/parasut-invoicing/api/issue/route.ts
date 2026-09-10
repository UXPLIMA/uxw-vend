import { NextResponse } from "next/server";
import { auth } from "@/core/sdk/auth";
import { isAdmin, prisma } from "@/core/sdk/server";
import { needsAttention, operatorSummary, type InvoiceStatus, type LegalState } from "../../lib/invoice-state";

/**
 * GET /api/v1/parasut-invoicing/issue - the sales that still owe something.
 *
 * An operator installed this because they are obliged to issue invoices, so
 * what they need is every order that is not finished. Two kinds are not, and
 * only one of them used to be listed.
 *
 * The ones that failed, which have always been here.
 *
 * And the ones that recorded. A sales invoice exists in the accounting
 * service and the legal e-document does not, because the second call that
 * makes one is not a call this module makes. Those rows read `issued` and
 * looked finished; they were the shop's whole invoicing obligation half done,
 * invisibly. See lib/invoice-state.ts.
 *
 * Reading the list is all this does: a retry happens on the order's next
 * completion, which is the one path that holds the claim.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /*
     * One read, partitioned here rather than two reads with the rule written
     * into each `where`. The rule is what a row still owes, it lives in
     * `invoice-state.ts`, and a copy of it in SQL is the copy that stops
     * agreeing the day the states change.
     *
     * Bounded like the list it replaced: an operator reads the oldest
     * unfinished orders, not every invoice ever written.
     */
    const unfinished = await prisma.issuedInvoice.findMany({
        where: { status: { not: "pending" } },
        orderBy: { updatedAt: "desc" },
        take: 200,
    });

    const owing = unfinished
        .map((row) => ({
            row,
            state: { status: row.status as InvoiceStatus, legalDocument: row.legalDocument as LegalState },
        }))
        .filter(({ state }) => needsAttention(state))
        .map(({ row, state }) => ({ ...row, ...operatorSummary(state) }));

    return NextResponse.json(
        {
            failures: owing.filter((row) => row.status === "failed"),
            awaitingDocument: owing.filter((row) => row.recorded),
            // Said in the answer rather than left for a screen to know: any
            // caller reading this endpoint is entitled to the same warning.
            note: "A recorded sale is in the accounting service. The legal e-document is a separate step this module does not take yet.",
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
}
