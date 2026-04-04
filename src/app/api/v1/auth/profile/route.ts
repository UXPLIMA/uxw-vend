import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { updateUserSchema, updatePasswordSchema } from "@/core/lib/validations";
import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/core/lib/constants";

// GET /api/v1/auth/profile
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
            twoFactorEnabled: true,
            role: { select: { name: true, displayName: true, color: true } },
            _count: { select: { orders: true, tickets: true, topics: true, comments: true } },
        },
    });

    return NextResponse.json({ user });
}

// PATCH /api/v1/auth/profile - Update profile
export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Password change
    if (body.currentPassword && body.newPassword) {
        const validation = updatePasswordSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (!user?.password) {
            return NextResponse.json({ error: "Cannot change password for OAuth accounts" }, { status: 400 });
        }

        const isValid = await bcrypt.compare(validation.data.currentPassword, user.password);
        if (!isValid) {
            return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(validation.data.newPassword, BCRYPT_ROUNDS);
        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: hashedPassword },
        });

        return NextResponse.json({ message: "Password updated" });
    }

    // Profile update
    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (validation.data.username) {
        const existing = await prisma.user.findFirst({
            where: { username: validation.data.username, id: { not: session.user.id } },
        });
        if (existing) {
            return NextResponse.json({ error: "Username already taken" }, { status: 400 });
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

    return NextResponse.json({ user });
}
