/**
 * A read-only check, for software that wants to know a key is still good
 * without claiming a seat. Same public exposure as activation, same limits.
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimits, withRateLimit } from "@/core/sdk/server";
import { checkLicense } from "../../../lib/licenses";

export const POST = withRateLimit(async (request: NextRequest) => {
    const body = await request.json().catch(() => ({}));
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!key) return NextResponse.json({ valid: false, reason: "missing_fields" }, { status: 400 });

    const result = await checkLicense(key);
    if (!result.ok) return NextResponse.json({ valid: false, reason: result.reason }, { status: 403 });

    return NextResponse.json({
        valid: true,
        product: result.productName,
        expiresAt: result.expiresAt,
        activationsUsed: result.activationsUsed,
        maxActivations: result.maxActivations,
    });
}, rateLimits.auth);
