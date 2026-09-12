import { NextRequest, NextResponse } from "next/server";
import { prisma, readJsonBody, siteTimeZone } from "@/core/sdk/server";
import { z } from "zod";
import { PRIVATE, refuseUnlessInvited } from "../../../lib/request";
import { readTurkishDateTime } from "../../../lib/turkish-date";

/*
 * @provider-callback: the integrator signs in with the shared secret in a
 * `token` header rather than a session, so there is no `auth()` here to find.
 * `refuseUnlessInvited` compares it in constant time and a blank secret
 * refuses everybody.
 */
/**
 * POST /api/v1/birfatura/api/invoiceLinkUpdate - the invoice it issued.
 *
 * This is the half of the integration that comes back. The shop hands over
 * its sales and, until this existed, heard nothing: an operator could not
 * tell an invoiced order from one nobody had touched, and the document a
 * customer is entitled to ask for was only in the integrator's system.
 *
 * Keyed on the order, and written as an upsert, because the call is repeated
 * when an invoice is reissued and a second row would be a second invoice that
 * does not exist.
 *
 * The field names are the integrator's, in its own language, because they are
 * what it sends.
 */
const updateSchema = z.object({
    orderId: z.union([z.string(), z.number()]),
    faturaUrl: z.string().url().max(1000),
    faturaNo: z.string().max(64).optional().nullable(),
    faturaTarihi: z.string().max(32).optional().nullable(),
});

export async function POST(request: NextRequest) {
    const refused = await refuseUnlessInvited(request);
    if (refused) return refused;

    const body = await readJsonBody(request, { fallback: {} });
    if (body instanceof NextResponse) return body;

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { Success: false, Message: parsed.error.issues[0].message },
            { status: 400, headers: PRIVATE },
        );
    }

    const orderId = String(parsed.data.orderId);
    const issuedAt = readTurkishDateTime(parsed.data.faturaTarihi, await siteTimeZone());

    await prisma.shopInvoice.upsert({
        where: { orderId },
        create: {
            orderId,
            url: parsed.data.faturaUrl,
            number: parsed.data.faturaNo ?? null,
            issuedAt,
        },
        // A repeat call carries the link and not always the rest. Writing
        // null for what it did not send would erase the number an accountant
        // was given, on a call that was only telling us the link changed.
        update: {
            url: parsed.data.faturaUrl,
            ...(parsed.data.faturaNo ? { number: parsed.data.faturaNo } : {}),
            ...(issuedAt ? { issuedAt } : {}),
        },
    });

    return NextResponse.json({ Success: true }, { headers: PRIVATE });
}
