import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { rateLimit, getClientIP } from "@/core/lib/rate-limit";
import { softDeleteUser } from "@/core/lib/user-deletion";
import { logActivity } from "@/core/lib/activity-log";
import { readJsonBody } from "@/core/lib/api-body";

const deleteSchema = z.object({
    password: z.string().min(1, "Password required"),
    confirmText: z.literal("DELETE", {
        message: "You must type DELETE to confirm",
    }),
});

// POST /api/v1/auth/profile/delete
// Self-service account deletion. Requires password re-verification and
// the literal text "DELETE" to guard against UI accidents / CSRF-lite.
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const rl = await rateLimit(`profile-delete:${userId}`, {
        maxRequests: 3,
        windowMs: 15 * 60 * 1000,
    });
    if (!rl.success) {
        return NextResponse.json(
            { error: "Too many attempts. Try again later.", code: "rate_limited" },
            { status: 429 }
        );
    }

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;

    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input", code: "invalid_input" },
            { status: 400 }
        );
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true },
    });
    if (!user) {
        return NextResponse.json({ error: "User not found", code: "user_not_found" }, { status: 404 });
    }
    if (!user.password) {
        return NextResponse.json(
            {
                error:
                    "This account signs in via an external provider. Contact support to delete your account.",
                code: "oauth_account_delete",
            },
            { status: 400 }
        );
    }

    const passwordOk = await bcrypt.compare(parsed.data.password, user.password);
    if (!passwordOk) {
        return NextResponse.json({ error: "Incorrect password", code: "wrong_password" }, { status: 400 });
    }

    const result = await softDeleteUser(userId, "Self-requested deletion");
    if (!result.success) {
        return NextResponse.json(
            { error: result.error ?? "Failed to delete account", code: "delete_failed" },
            { status: 500 }
        );
    }

    await logActivity({
        userId,
        action: "user.account.deleted",
        entity: "User",
        entityId: userId,
        metadata: { reason: "self-service" },
        ipAddress: getClientIP(request.headers),
    });

    return NextResponse.json({ success: true });
}
