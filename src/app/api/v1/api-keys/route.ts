import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/core/lib/constants";
import { logActivity } from "@/core/lib/activity-log";
import { readJsonBody } from "@/core/lib/api-body";
import { z } from "zod";

/**
 * A new API key. `expiresAt` used to reach `new Date(...)` untyped, and an
 * unparseable value there is an Invalid Date that Prisma rejects with a 500
 * rather than a 400.
 */
const createApiKeySchema = z.object({
    name: z.string().trim().min(1, "Name required").max(100),
    permissions: z.array(z.string().max(128)).max(200).optional(),
    expiresAt: z.iso.datetime({ offset: true }).optional().nullable(),
});

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

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsed = createApiKeySchema.safeParse(jsonBody);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Name required" }, { status: 400 });
    }
    const { name, permissions, expiresAt } = parsed.data;

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

    logActivity({
        userId: session.user.id,
        action: "apikey.create",
        entity: "apiKey",
        entityId: apiKey.id,
        metadata: { name: apiKey.name, permissions: apiKey.permissions, expiresAt: apiKey.expiresAt },
    }).catch(() => {});

    // Return the raw key ONLY on creation - it cannot be retrieved again
    return NextResponse.json({
        apiKey: { id: apiKey.id, name: apiKey.name, key: rawKey, keyPrefix, permissions: apiKey.permissions, expiresAt: apiKey.expiresAt, createdAt: apiKey.createdAt },
        warning: "Save this key now. It cannot be shown again.",
    }, { status: 201 });
}
