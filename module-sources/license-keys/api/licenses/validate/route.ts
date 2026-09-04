/**
 * A read-only check, for software that wants to know a key is still good
 * without claiming a seat. Same public exposure as activation, same limits.
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimits, withRateLimit, readJsonBody } from "@/core/sdk/server";
import { checkLicense } from "../../../lib/licenses";
import { validateSchema } from "../../../lib/validations";

export const POST = withRateLimit("license-validate", async (request: NextRequest) => {
    const body = await readJsonBody(request, { fallback: {} });
    if (body instanceof NextResponse) return body;
    const parsed = validateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ valid: false, reason: "missing_fields" }, { status: 400 });
    const { key } = parsed.data;

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
