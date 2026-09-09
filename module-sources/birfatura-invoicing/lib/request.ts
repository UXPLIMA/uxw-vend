/**
 * The half of every endpoint here that is the same: who is asking.
 *
 * All three answers carry customer data, so all three are behind the same
 * check, written once. A refusal says nothing about why: an integrator with
 * the wrong secret and one that sent none are the same 401, because the
 * difference is only useful to somebody guessing.
 */
import { NextRequest, NextResponse } from "next/server";
import { tokenAccepted } from "./token";
import { invoicingToken } from "./setup";

/** The answer to send when the caller is not the integrator, or null when it is. */
export async function refuseUnlessInvited(request: NextRequest): Promise<NextResponse | null> {
    const sent = request.headers.get("token") ?? request.headers.get("Token");
    if (tokenAccepted(sent, await invoicingToken())) return null;
    return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
}

/** Every answer here is one caller's, and none of it may be kept. */
export const PRIVATE = { "Cache-Control": "private, no-store" } as const;
