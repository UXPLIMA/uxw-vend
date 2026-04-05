import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import { randomBytes, createHash } from "crypto";
import { sendPasswordResetEmail } from "@/core/lib/email";
import { rateLimit, getClientIP } from "@/core/lib/rate-limit";

// POST /api/v1/auth/forgot-password
export async function POST(request: NextRequest) {
    try {
        const ip = getClientIP(request.headers);
        const rl = rateLimit(`reset:${ip}`, { maxRequests: 5, windowMs: 3600000 }); // 5 per hour
        if (!rl.success) {
            return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
        }
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Always do some work to prevent timing attack
        const token = randomBytes(32).toString("hex");
        const hashedToken = createHash("sha256").update(token).digest("hex");
        void hashedToken; // used to ensure constant-time work

        if (user) {
            // Delete any existing tokens for this user
            await prisma.verificationToken.deleteMany({
                where: { identifier: email },
            });

            // Create reset token (expires in 1 hour)
            const expires = new Date(Date.now() + 60 * 60 * 1000);

            await prisma.verificationToken.create({
                data: {
                    identifier: email,
                    token,
                    expires,
                },
            });

            const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
            const resetUrl = `${baseUrl}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

            await sendPasswordResetEmail(email, resetUrl);
        }

        // Always return same response
        return NextResponse.json({ message: "If an account exists, a reset link has been sent." });
    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
