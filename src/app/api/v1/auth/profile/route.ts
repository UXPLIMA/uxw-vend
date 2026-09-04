import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { rateLimit } from "@/core/lib/rate-limit";
import { enforcePasswordPolicy } from "@/core/lib/security-settings";
import { updateUserSchema, updatePasswordSchema } from "@/core/lib/validations";
import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/core/lib/constants";
import { readJsonBody } from "@/core/lib/api-body";

// GET /api/v1/auth/profile
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
            locale: true,
            currency: true,
            createdAt: true,
            role: { select: { name: true, displayName: true, color: true } },
        },
    });

    return NextResponse.json({ user });
}

// PATCH /api/v1/auth/profile - Update profile
export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
    }

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;

    // Password change
    if (body.currentPassword && body.newPassword) {
        // `bcrypt.compare` below turns this branch into a password oracle, and
        // one bcrypt round at cost 12 per request is a CPU sink besides. The
        // account deletion route has always had this ceiling; the branch that
        // changes the password did not.
        const rl = await rateLimit(`profile-password:${session.user.id}`, {
            maxRequests: 5,
            windowMs: 15 * 60 * 1000,
        });
        if (!rl.success) {
            return NextResponse.json(
                { error: "Too many attempts. Try again later.", code: "rate_limited" },
                { status: 429 },
            );
        }

        const validation = updatePasswordSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues[0].message, code: "invalid_input" }, { status: 400 });
        }

        const policyCheck = await enforcePasswordPolicy(validation.data.newPassword);
        if (!policyCheck.ok) {
            return NextResponse.json({ error: policyCheck.message ?? "Invalid password", code: "weak_password" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (!user?.password) {
            return NextResponse.json({ error: "Cannot change password for OAuth accounts", code: "oauth_password_change" }, { status: 400 });
        }

        const isValid = await bcrypt.compare(validation.data.currentPassword, user.password);
        if (!isValid) {
            return NextResponse.json({ error: "Current password is incorrect", code: "wrong_password" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(validation.data.newPassword, BCRYPT_ROUNDS);
        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: hashedPassword },
        });

        // Fire user.password.changed hook
        import("@/core/lib/hooks")
            .then(({ doActionAsync }) =>
                doActionAsync("user.password.changed", { userId: session.user.id })
            )
            .catch(() => {});

        return NextResponse.json({ message: "Password updated" });
    }

    // Profile update
    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message, code: "invalid_input" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (validation.data.username) {
        const existing = await prisma.user.findFirst({
            where: { username: validation.data.username, id: { not: session.user.id } },
        });
        if (existing) {
            return NextResponse.json({ error: "Username already taken", code: "username_taken" }, { status: 400 });
        }
        data.username = validation.data.username;
    }
    if (validation.data.avatar !== undefined) data.avatar = validation.data.avatar;
    if (body.locale) data.locale = body.locale;
    if (body.currency) data.currency = body.currency;

    const user = await prisma.user.update({
        where: { id: session.user.id },
        data,
        select: { id: true, username: true, avatar: true, locale: true, currency: true },
    });

    // Fire user.profile.updated hook - modules can react (audit, sync, etc.)
    import("@/core/lib/hooks")
        .then(({ doActionAsync }) =>
            doActionAsync("user.profile.updated", {
                userId: session.user.id,
                changes: data,
            })
        )
        .catch(() => {});

    return NextResponse.json({ user });
}
