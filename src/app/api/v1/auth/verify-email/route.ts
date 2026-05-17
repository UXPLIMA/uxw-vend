import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { randomBytes, createHash } from "crypto";
import { sendVerificationEmail } from "@/core/lib/email";
import { rateLimit } from "@/core/lib/rate-limit";

function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

// POST /api/v1/auth/verify-email - Send verification email

export async function POST(_request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Per-user cap stops an authenticated user from generating unlimited
    // verification email sends (and DB rows). 3 per hour matches the
    // forgot-password limit and is plenty for a legitimate user.
    const rl = await rateLimit(`verify-email:user:${session.user.id}`, { maxRequests: 3, windowMs: 3600000 });
    if (!rl.success) {
        return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.emailVerified) {
        return NextResponse.json({ error: "Email already verified" }, { status: 400 });
    }

    // Delete existing tokens
    await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });

    // Create token (24h). Store only the SHA-256 digest — a DB dump
    // exposes hashes, not usable verification tokens. The plaintext token
    // is only ever in the outbound email URL. Same pattern as forgot-password.
    const token = randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
        data: {
            identifier: user.email,
            token: hashToken(token),
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
    });

    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;

    await sendVerificationEmail(user.email, verifyUrl, user.locale ?? undefined);

    return NextResponse.json({ message: "Verification email sent" });
}

// GET /api/v1/auth/verify-email?token=...&email=... - Verify
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get("token");
    const email = request.nextUrl.searchParams.get("email");

    if (!token || !email) {
        return NextResponse.json({ error: "Missing token or email" }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const verificationToken = await prisma.verificationToken.findFirst({
        where: { identifier: email, token: tokenHash, expires: { gt: new Date() } },
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
        where: { identifier_token: { identifier: email, token: tokenHash } },
    });

    // Fire user.email.verified hook — look up user id for payload
    try {
        const verifiedUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });
        if (verifiedUser) {
            const { doActionAsync } = await import("@/core/lib/hooks");
            await doActionAsync("user.email.verified", {
                userId: verifiedUser.id,
                email,
            }).catch(() => {});
        }
    } catch { /* non-fatal */ }

    return NextResponse.json({ message: "Email verified successfully" });
}
