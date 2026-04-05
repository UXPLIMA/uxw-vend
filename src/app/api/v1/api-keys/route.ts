import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/core/lib/constants";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const keys = await prisma.apiKey.findMany({
        select: {
            id: true,
            name: true,
            keyPrefix: true,
            permissions: true,
            lastUsedAt: true,
            expiresAt: true,
            isActive: true,
            createdAt: true,
            user: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ keys: keys.map((k) => ({ ...k, key: k.keyPrefix + "..." })) });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name, permissions, expiresAt } = await request.json();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const rawKey = `uxw_${randomBytes(24).toString("hex")}`;
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);

    const apiKey = await prisma.apiKey.create({
        data: {
            name,
            keyHash,
            keyPrefix,
            userId: session.user.id,
            permissions: permissions || [],
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
    });

    // Return the raw key ONLY on creation — it cannot be retrieved again
    return NextResponse.json({
        apiKey: { id: apiKey.id, name: apiKey.name, key: rawKey, keyPrefix, permissions: apiKey.permissions, expiresAt: apiKey.expiresAt, createdAt: apiKey.createdAt },
        warning: "Save this key now. It cannot be shown again.",
    }, { status: 201 });
}
