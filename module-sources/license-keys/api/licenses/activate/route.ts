/**
 * What the customer's own software calls.
 *
 * Public and unauthenticated by necessity - the software has a key, not a
 * website session - which is why it is rate limited, says the same thing about
 * a wrong key as about one that never existed, and never echoes the key back.
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimits, withRateLimit, readJsonBody } from "@/core/sdk/server";
import { checkLicense, releaseActivation } from "../../../lib/licenses";
import { activateSchema, releaseSchema } from "../../../lib/validations";

export const POST = withRateLimit("license-activate", async (request: NextRequest) => {
    const body = await readJsonBody(request, { fallback: {} });
    if (body instanceof NextResponse) return body;
    const parsed = activateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ valid: false, reason: "missing_fields" }, { status: 400 });
    }
    const { key, machineId } = parsed.data;
    const label = parsed.data.label ?? null;

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
export const DELETE = withRateLimit("license-release", async (request: NextRequest) => {
    const body = await readJsonBody(request, { fallback: {} });
    if (body instanceof NextResponse) return body;
    const parsed = releaseSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ released: false, reason: "missing_fields" }, { status: 400 });
    }
    const { key, machineId } = parsed.data;
    return NextResponse.json({ released: await releaseActivation(key, machineId) });
}, rateLimits.auth);
