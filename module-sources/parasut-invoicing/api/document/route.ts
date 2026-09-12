import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/sdk/auth";
import { isAdmin, prisma, readJsonBody, readSettingStrings } from "@/core/sdk/server";
import { z } from "zod";
import { refreshLegalDocument, sendLegalDocument } from "../../lib/send-document";
import { isConfigured } from "../../lib/client";

/**
 * POST /api/v1/parasut-invoicing/document - ask for one sale's document, or
 * ask again where it got to.
 *
 * Sending is an administrator's decision per sale unless they turned the
 * setting on, because it is irreversible: a document the tax authority has
 * accepted is cancelled by a procedure, not by deleting a row here.
 *
 * A sale that has no invoice in the accounting service has nothing to make a
 * document from, and says so rather than sending an empty one.
 */
const askSchema = z.object({
    orderId: z.string().min(1).max(64),
    action: z.enum(["send", "refresh"]).default("send"),
});

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!(await isConfigured())) {
        return NextResponse.json({ error: "not_configured" }, { status: 400 });
    }

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = askSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const row = await prisma.issuedInvoice.findUnique({ where: { orderId: parsed.data.orderId } });
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (parsed.data.action === "refresh") {
        return NextResponse.json(await refreshLegalDocument(row.orderId));
    }

    if (row.status !== "recorded" || !row.remoteId) {
        return NextResponse.json({ error: "not_recorded" }, { status: 409 });
    }
    // Asking twice would put a second document in front of the authority for
    // one sale, which is the thing that has to be undone by hand.
    if (row.legalDocument !== "not_requested" && row.legalDocument !== "failed") {
        return NextResponse.json({ error: "already_requested", state: row.legalDocument }, { status: 409 });
    }

    // Everything the document needs is on this module's own row: the shop's
    // orders are the shop's, and this one was written when the sale was.
    const site = await readSettingStrings(["site_url"]);
    const outcome = await sendLegalDocument({
        orderId: row.orderId,
        salesInvoiceId: row.remoteId,
        taxNumber: row.buyerTaxNumber ?? "",
        shopUrl: site.site_url ?? "",
        paymentMethod: row.paymentMethod,
        paidAt: row.paidAt ?? row.issuedAt ?? new Date(),
        invoiceNumber: row.remoteNumber,
    });

    return NextResponse.json(outcome);
}
