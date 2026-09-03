/**
 * What the customer's own software calls.
 *
 * Public and unauthenticated by necessity - the software has a key, not a
 * website session - which is why it is rate limited, says the same thing about
 * a wrong key as about one that never existed, and never echoes the key back.
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimits, withRateLimit } from "@/core/sdk/server";
import { checkLicense, releaseActivation } from "../../../lib/licenses";

export const POST = withRateLimit(async (request: NextRequest) => {
    const body = await request.json().catch(() => ({}));
    const key = typeof body.key === "string" ? body.key.trim() : "";
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    const label = typeof body.label === "string" ? body.label.slice(0, 100) : null;

    if (!key || !machineId) {
        return NextResponse.json({ valid: false, reason: "missing_fields" }, { status: 400 });
    }

    const result = await checkLicense(key, { machineId, label });
    if (!result.ok) {
        return NextResponse.json({ valid: false, reason: result.reason }, { status: 403 });
    }

    return NextResponse.json({
        valid: true,
        product: result.productName,
        expiresAt: result.expiresAt,
        activationsUsed: result.activationsUsed,
        maxActivations: result.maxActivations,
        newActivation: result.newActivation,
    });
}, rateLimits.auth);

/** Frees this machine's seat so the customer can move to another one. */
export const DELETE = withRateLimit(async (request: NextRequest) => {
    const body = await request.json().catch(() => ({}));
    const key = typeof body.key === "string" ? body.key.trim() : "";
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    if (!key || !machineId) {
        return NextResponse.json({ released: false, reason: "missing_fields" }, { status: 400 });
    }
    return NextResponse.json({ released: await releaseActivation(key, machineId) });
}, rateLimits.auth);
