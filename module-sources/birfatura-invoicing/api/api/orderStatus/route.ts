import { NextRequest, NextResponse } from "next/server";
import { PRIVATE, refuseUnlessInvited } from "../../../lib/request";


/*
 * @provider-callback: this integrator signs in with a shared secret in a
 * `token` header rather than a session, so there is no `auth()` here to find.
 * `refuseUnlessInvited` compares it against the operator's secret in constant
 * time (`lib/token.ts`, `crypto.timingSafeEqual` over digests, and a blank
 * secret refuses everybody), and every handler below calls it first.
 */
/**
 * POST /api/v1/birfatura/order-statuses - which states an order can be in.
 *
 * The integrator asks once and then tells the operator which of them to
 * invoice. The list is the store's own, so an operator picking "Completed"
 * there is picking the state this shop actually reaches when money arrives.
 */
const STATUSES = [
    { Id: "PENDING", Value: "Pending" },
    { Id: "PROCESSING", Value: "Processing" },
    { Id: "COMPLETED", Value: "Completed" },
    { Id: "CANCELLED", Value: "Cancelled" },
    { Id: "REFUNDED", Value: "Refunded" },
];

export async function POST(request: NextRequest) {
    const refused = await refuseUnlessInvited(request);
    if (refused) return refused;
    return NextResponse.json({ OrderStatus: STATUSES }, { headers: PRIVATE });
}
