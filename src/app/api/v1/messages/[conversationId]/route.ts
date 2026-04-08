import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

type RouteParams = { params: Promise<{ conversationId: string }> };

/** GET — fetch all messages in a conversation + mark as read */
export async function GET(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;

    // Verify the user is a participant
    const participation = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: session.user.id } },
    });
    if (!participation) {
        return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }

    const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, username: true, avatar: true } } },
    });

    // Mark as read
    await prisma.conversationParticipant.update({
        where: { id: participation.id },
        data: { lastReadAt: new Date() },
    });

    return NextResponse.json({ messages });
}

const replySchema = z.object({
    body: z.string().min(1).max(10000),
});

/** POST — reply to an existing conversation */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { conversationId } = await params;
    const participation = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: session.user.id } },
    });
    if (!participation) {
        return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });
    }

    const message = await prisma.message.create({
        data: {
            conversationId,
            authorId: session.user.id,
            body: parsed.data.body,
        },
    });

    await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.createdAt },
    });

    return NextResponse.json({ message }, { status: 201 });
}
