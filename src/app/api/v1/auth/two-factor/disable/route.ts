import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { verifyToken } from "@/core/lib/two-factor";

// POST /api/v1/auth/two-factor/disable - Disable 2FA
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await request.json();
    if (!token) {
        return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
    }

    const isValid = verifyToken(user.twoFactorSecret, token);
    if (!isValid) {
        return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    await prisma.user.update({
        where: { id: session.user.id },
        data: {
            twoFactorEnabled: false,
            twoFactorSecret: null,
            backupCodes: null,
        },
    });

    return NextResponse.json({ message: "Two-factor authentication disabled" });
}
