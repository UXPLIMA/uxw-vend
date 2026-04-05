import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/core/lib/constants";
import { rateLimit, getClientIP } from "@/core/lib/rate-limit";
import { logActivity } from "@/core/lib/activity-log";

// POST /api/v1/auth/reset-password
export async function POST(request: NextRequest) {
    try {
        const ip = getClientIP(request.headers);
        const rl = await rateLimit(`reset:${ip}`, { maxRequests: 5, windowMs: 3600000 }); // 5 per hour
        if (!rl.success) {
            return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
        }

        const { email, token, password } = await request.json();

        if (!email || !token || !password) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
        }
        if (!/[A-Z]/.test(password)) {
            return NextResponse.json({ error: "Password must contain at least one uppercase letter" }, { status: 400 });
        }
        if (!/[0-9]/.test(password)) {
            return NextResponse.json({ error: "Password must contain at least one number" }, { status: 400 });
        }

        // Find and validate token
        const verificationToken = await prisma.verificationToken.findFirst({
            where: {
                identifier: email,
                token,
                expires: { gt: new Date() },
            },
        });

        if (!verificationToken) {
            return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
        }

        // Find user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Hash new password and update
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        // Delete used token
        await prisma.verificationToken.delete({
            where: {
                identifier_token: {
                    identifier: email,
                    token,
                },
            },
        });

        // Audit log
        await logActivity({ userId: user.id, action: "password.reset", entity: "user", entityId: user.id }).catch(() => {});

        return NextResponse.json({ message: "Password has been reset successfully" });
    } catch (error) {
        console.error("Reset password error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
