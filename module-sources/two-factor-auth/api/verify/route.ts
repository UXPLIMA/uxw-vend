import { NextRequest, NextResponse } from "next/server";
import { generateBackupCodes, prisma, rateLimitStrict, verifyToken, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

// POST /api/v1/auth/two-factor/verify - Verify token and enable 2FA
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The token is a six-digit code checked against a secret that does not
    // change, so unlimited attempts are unlimited guesses.
    const rl = await rateLimitStrict(`2fa-verify:${session.user.id}`, {
        maxRequests: 10,
        windowMs: 15 * 60 * 1000,
    });
    if (!rl.success) {
        return NextResponse.json(
            { error: "Too many attempts. Try again later." },
            { status: 429 },
        );
    }

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const { token } = jsonBody;
    if (!token) {
        return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || !user.twoFactorSecret) {
        return NextResponse.json({ error: "2FA setup not initiated" }, { status: 400 });
    }

    const isValid = verifyToken(user.twoFactorSecret, token);
    if (!isValid) {
        return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    // Generate backup codes
    const { codes, hashed } = generateBackupCodes();

    // Enable 2FA
    await prisma.user.update({
        where: { id: session.user.id },
        data: {
            twoFactorEnabled: true,
            backupCodes: JSON.stringify(hashed),
        },
    });

    // Fire user.2fa.enabled hook - security audit trail, etc.
    import("@/core/sdk")
        .then(({ doActionAsync }) =>
            doActionAsync("user.2fa.enabled", { userId: session.user!.id })
        )
        .catch(() => {});

    return NextResponse.json({
        message: "Two-factor authentication enabled",
        backupCodes: codes,
    });
}
