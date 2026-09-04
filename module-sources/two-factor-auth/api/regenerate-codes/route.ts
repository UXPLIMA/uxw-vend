import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { generateBackupCodes, prisma, rateLimitStrict, verifyToken } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

// POST /api/v1/auth/two-factor/regenerate-codes - Regenerate backup codes
// Requires current password OR a valid TOTP code.
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same guessing loop as disable, and the prize is a fresh set of backup
    // codes for the account.
    const rl = await rateLimitStrict(`2fa-regenerate:${session.user.id}`, {
        maxRequests: 5,
        windowMs: 15 * 60 * 1000,
    });
    if (!rl.success) {
        return NextResponse.json(
            { error: "Too many attempts. Try again later." },
            { status: 429 },
        );
    }

    let body: { password?: string; token?: string } = {};
    try {
        body = await request.json();
    } catch {
        body = {};
    }
    const { password, token } = body;

    if (!password && !token) {
        return NextResponse.json(
            { error: "Password or verification code required" },
            { status: 400 }
        );
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            password: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
        } as Record<string, true>,
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userAny = user as Record<string, unknown>;

    if (!userAny.twoFactorEnabled || !userAny.twoFactorSecret) {
        return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
    }

    // Verify password OR TOTP code
    let authorized = false;

    if (token) {
        authorized = verifyToken(userAny.twoFactorSecret as string, token);
    }

    if (!authorized && password) {
        const storedPassword = userAny.password as string | null;
        if (storedPassword) {
            authorized = await bcrypt.compare(password, storedPassword);
        }
    }

    if (!authorized) {
        return NextResponse.json(
            { error: "Invalid password or verification code" },
            { status: 401 }
        );
    }

    const { codes, hashed } = generateBackupCodes(10);

    await prisma.user.update({
        where: { id: session.user.id },
        data: { backupCodes: JSON.stringify(hashed) } as Record<string, unknown>,
    });

    return NextResponse.json({
        message: "Backup codes regenerated",
        backupCodes: codes,
    });
}
