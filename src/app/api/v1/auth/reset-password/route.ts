import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";
import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/core/lib/constants";

// POST /api/v1/auth/reset-password
export async function POST(request: NextRequest) {
    try {
        const { email, token, password } = await request.json();

        if (!email || !token || !password) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
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

        return NextResponse.json({ message: "Password has been reset successfully" });
    } catch (error) {
        console.error("Reset password error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
