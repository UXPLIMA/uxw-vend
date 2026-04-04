import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { randomBytes } from "crypto";
import { sendVerificationEmail } from "@/core/lib/email";

// POST /api/v1/auth/verify-email - Send verification email
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.emailVerified) {
        return NextResponse.json({ error: "Email already verified" }, { status: 400 });
    }

    // Delete existing tokens
    await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });

    // Create token (24h)
    const token = randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
        data: {
            identifier: user.email,
            token,
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
    });

    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;

    await sendVerificationEmail(user.email, verifyUrl);

    return NextResponse.json({ message: "Verification email sent" });
}

// GET /api/v1/auth/verify-email?token=...&email=... - Verify
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get("token");
    const email = request.nextUrl.searchParams.get("email");

    if (!token || !email) {
        return NextResponse.json({ error: "Missing token or email" }, { status: 400 });
    }

    const verificationToken = await prisma.verificationToken.findFirst({
        where: { identifier: email, token, expires: { gt: new Date() } },
    });

    if (!verificationToken) {
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    // Mark email as verified
    await prisma.user.updateMany({
        where: { email },
        data: { emailVerified: new Date() },
    });

    // Delete token
    await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: email, token } },
    });

    return NextResponse.json({ message: "Email verified successfully" });
}
