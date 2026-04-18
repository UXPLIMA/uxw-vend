import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

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

    const { provider, providerId, username, avatar } = await request.json();
    if (!provider || !providerId) return NextResponse.json({ error: "Provider and ID required" }, { status: 400 });

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

    const { provider } = await request.json();
    if (!provider) return NextResponse.json({ error: "Provider required" }, { status: 400 });

    await prisma.linkedAccount.deleteMany({
        where: { userId: session.user.id, provider },
    });

    return NextResponse.json({ message: `${provider} account unlinked` });
}
