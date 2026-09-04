import { NextRequest, NextResponse } from "next/server";
import { prisma, readJsonBody, rateLimitForRoleAsync } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { linkAccountSchema, unlinkAccountSchema } from "../../lib/validations";

// GET /api/v1/linked-accounts
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accounts = await prisma.linkedAccount.findMany({
        where: { userId: session.user.id },
    });

    return NextResponse.json({ accounts });
}

// POST /api/v1/linked-accounts - Link an account
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await rateLimitForRoleAsync(
        `linked-account:${session.user.id}`,
        { maxRequests: 20, windowMs: 60_000 },
        session.user.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, { status: 429 });
    }

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsed = linkAccountSchema.safeParse(jsonBody);
    if (!parsed.success) {
        return NextResponse.json({ error: "Provider and ID required" }, { status: 400 });
    }
    const { provider, providerId, username, avatar } = parsed.data;

    // Check if already linked to another user
    const existing = await prisma.linkedAccount.findUnique({
        where: { provider_providerId: { provider, providerId } },
    });
    if (existing && existing.userId !== session.user.id) {
        return NextResponse.json({ error: "Unable to link account" }, { status: 400 });
    }

    const account = await prisma.linkedAccount.upsert({
        where: { provider_providerId: { provider, providerId } },
        update: { username, avatar },
        create: { userId: session.user.id, provider, providerId, username, avatar },
    });

    return NextResponse.json({ account });
}

// DELETE /api/v1/linked-accounts
export async function DELETE(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await rateLimitForRoleAsync(
        `linked-account:${session.user.id}`,
        { maxRequests: 20, windowMs: 60_000 },
        session.user.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, { status: 429 });
    }

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsedUnlink = unlinkAccountSchema.safeParse(jsonBody);
    if (!parsedUnlink.success) {
        return NextResponse.json({ error: "Provider required" }, { status: 400 });
    }
    const { provider } = parsedUnlink.data;

    await prisma.linkedAccount.deleteMany({
        where: { userId: session.user.id, provider },
    });

    return NextResponse.json({ message: `${provider} account unlinked` });
}
