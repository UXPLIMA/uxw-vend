import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/core/lib/api-body";
import { prisma } from "@/core/lib/db";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { BCRYPT_ROUNDS } from "@/core/lib/constants";
import { rateLimit, getClientIP } from "@/core/lib/rate-limit";
import { logActivity } from "@/core/lib/activity-log";
import { checkPasswordBreach } from "@/core/lib/password-breach";
import { enforcePasswordPolicy } from "@/core/lib/security-settings";

/**
 * The three fields a reset carries. `password` is bounded here only so an
 * absurd one never reaches bcrypt; the policy and breach checks below decide
 * whether it is acceptable.
 */
const resetPasswordSchema = z.object({
    email: z.string().min(1).max(254),
    token: z.string().min(1).max(256),
    password: z.string().min(1).max(200),
});

// POST /api/v1/auth/reset-password
export async function POST(request: NextRequest) {
    try {
        const ip = getClientIP(request.headers);
        const rl = await rateLimit(`reset:${ip}`, { maxRequests: 10, windowMs: 3600000 });
        if (!rl.success) {
            return NextResponse.json({ error: "Too many attempts. Try again later.", code: "rate_limited" }, { status: 429 });
        }

        const raw = await readJsonBody(request, { fallback: {} });
        if (raw instanceof NextResponse) return raw;
        const parsed = resetPasswordSchema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json({ error: "Missing required fields", code: "missing_fields" }, { status: 400 });
        }
        const email = parsed.data.email.trim().toLowerCase();
        const { token, password } = parsed.data;

        const policyCheck = await enforcePasswordPolicy(password);
        if (!policyCheck.ok) {
            return NextResponse.json(
                { error: policyCheck.message ?? "Invalid password", code: "weak_password" },
                { status: 400 },
            );
        }

        const breach = await checkPasswordBreach(password);
        if (!breach.ok) {
            return NextResponse.json(
                { error: "This password has appeared in a known data breach - pick something else.", code: "password_breached" },
                { status: 400 },
            );
        }

        // The DB stores the SHA-256 digest of the plaintext reset token we
        // mailed to the user. Hash the incoming value before lookup so the
        // plaintext never hits Prisma (and a DB dump yields only hashes).
        const tokenHash = createHash("sha256").update(token).digest("hex");

        // Atomically consume the token. `deleteMany` runs as a single SQL
        // statement, so two concurrent requests racing on the same token
        // cannot both see `count = 1` - exactly one wins, the other gets 0
        // and is rejected as an invalid token. This replaces the previous
        // findFirst → update → deleteMany pattern that allowed a narrow
        // window for the same token to be used twice.
        const { count: consumed } = await prisma.verificationToken.deleteMany({
            where: {
                identifier: email,
                token: tokenHash,
                expires: { gt: new Date() },
            },
        });

        if (consumed === 0) {
            return NextResponse.json({ error: "Invalid or expired reset token", code: "invalid_token" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.isBanned || user.isDeleted) {
            return NextResponse.json({ error: "Invalid or expired reset token", code: "invalid_token" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        // Also invalidate any *other* active reset tokens for this account
        // so an attacker holding a second token can't use it after the
        // password changes. The winning token is already gone.
        await prisma.verificationToken.deleteMany({ where: { identifier: email } });

        await logActivity({ userId: user.id, action: "password.reset", entity: "user", entityId: user.id }).catch(() => {});

        import("@/core/lib/hooks")
            .then(({ doActionAsync }) =>
                doActionAsync("user.password.changed", { userId: user.id })
            )
            .catch(() => {});

        return NextResponse.json({ message: "Password has been reset successfully" });
    } catch (error) {
        console.error("Reset password error:", error);
        return NextResponse.json({ error: "Internal server error", code: "server_error" }, { status: 500 });
    }
}
