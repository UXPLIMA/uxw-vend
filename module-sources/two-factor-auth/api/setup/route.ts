import { NextResponse } from "next/server";
import { generateQRCode, generateSecret, prisma, rateLimitForRoleAsync } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

// POST /api/v1/auth/two-factor/setup - Generate secret and QR code
export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await rateLimitForRoleAsync(
        `2fa-setup:${session.user.id}`,
        { maxRequests: 10, windowMs: 60_000 },
        session.user.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, { status: 429 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.twoFactorEnabled) {
        return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });
    }

    const { secret, uri } = generateSecret(user.email);
    const qrCode = await generateQRCode(uri);

    // Store secret temporarily (not yet enabled until verified)
    await prisma.user.update({
        where: { id: session.user.id },
        data: { twoFactorSecret: secret },
    });

    return NextResponse.json({ qrCode, secret });
}
