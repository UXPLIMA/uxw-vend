import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { verifyToken } from "@/core/lib/two-factor";

// POST /api/v1/auth/two-factor/disable - Disable 2FA
// Requires current password OR a valid TOTP code.
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { token?: string; password?: string } = {};
    try {
        body = await request.json();
    } catch {
        body = {};
    }
    const { token, password } = body;

    if (!token && !password) {
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

    // Verify password OR TOTP
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

    await prisma.user.update({
        where: { id: session.user.id },
        data: {
            twoFactorEnabled: false,
            twoFactorSecret: null,
            backupCodes: null,
        } as Record<string, unknown>,
    });

    // Fire user.2fa.disabled hook — security audit trail, etc.
    import("@/core/lib/hooks")
        .then(({ doActionAsync }) =>
            doActionAsync("user.2fa.disabled", { userId: session.user!.id })
        )
        .catch(() => {});

    return NextResponse.json({ message: "Two-factor authentication disabled" });
}
