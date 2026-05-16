import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { rateLimitForRole, getClientIP, rateLimits } from "@/core/lib/rate-limit";

// GET /api/v1/store/creator-codes/validate?code=XXX
export async function GET(request: NextRequest) {
    const ip = getClientIP(request.headers);
    const rl = await rateLimitForRole(`creator-validate:${ip}`, rateLimits.auth, undefined);
    if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const code = request.nextUrl.searchParams.get("code");
    if (!code) return NextResponse.json({ valid: false });

    const creatorCode = await prisma.creatorCode.findUnique({
        where: { code: code.toUpperCase() },
        select: { code: true, discountPercent: true, isActive: true, creator: { select: { username: true } } },
    });

    // creator becomes null when the creator's user account is deleted
    // (SetNull cascade); treat that as an invalid code.
    if (!creatorCode || !creatorCode.isActive || !creatorCode.creator) {
        return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
        valid: true,
        code: creatorCode.code,
        discountPercent: creatorCode.discountPercent,
        creator: creatorCode.creator.username,
    });
}
