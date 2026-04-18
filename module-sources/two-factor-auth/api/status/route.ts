import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { countRemainingBackupCodes } from "@/core/lib/two-factor";

// GET /api/v1/auth/two-factor/status - Current 2FA status for the signed-in user
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            twoFactorEnabled: true,
            backupCodes: true,
        } as Record<string, true>,
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userAny = user as Record<string, unknown>;
    const enabled = Boolean(userAny.twoFactorEnabled);
    const remainingBackupCodes = enabled ? countRemainingBackupCodes(userAny.backupCodes) : 0;

    return NextResponse.json({ enabled, remainingBackupCodes });
}
