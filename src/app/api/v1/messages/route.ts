import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

/**
 * GET — list current user's conversations with last message preview
 *       and unread count
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const myParticipations = await prisma.conversationParticipant.findMany({
        where: { userId: session.user.id },
        include: {
            conversation: {
                include: {
                    participants: {
                        include: { user: { select: { id: true, username: true, avatar: true } } },
                    },
                    messages: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                    },
                },
            },
        },
        orderBy: { conversation: { lastMessageAt: "desc" } },
    });

    // Unread counts in a single groupBy instead of one COUNT per conversation.
    // We can't express "createdAt > per-conversation lastReadAt" in a single
    // query, so we fetch all inbound messages and bucket them in memory.
    const userId = session.user.id;
    const convIds = myParticipations.map((p) => p.conversationId);
    const unreadById = new Map<string, number>();

    if (convIds.length > 0) {
        // lastReadAt cutoff per conversation for this user.
        const lastReadByConv = new Map<string, Date | null>();
        for (const p of myParticipations) {
            lastReadByConv.set(p.conversationId, p.lastReadAt);
        }

        // Group inbound messages per conversation; then subtract the ones
        // already read by walking the ids in a second cheap findMany.
        const inbound = await prisma.message.findMany({
            where: {
                conversationId: { in: convIds },
                authorId: { not: userId },
            },
            select: { conversationId: true, createdAt: true },
        });

        for (const m of inbound) {
            const cutoff = lastReadByConv.get(m.conversationId);
            if (!cutoff || m.createdAt > cutoff) {
                unreadById.set(m.conversationId, (unreadById.get(m.conversationId) ?? 0) + 1);
            }
        }
    }

    const conversations = myParticipations.map((p) => ({
        id: p.conversation.id,
        title: p.conversation.title,
        participants: p.conversation.participants
            .filter((cp: { userId: string }) => cp.userId !== userId)
            .map((cp: { user: { id: string; username: string; avatar: string | null } }) => cp.user),
        lastMessage: p.conversation.messages[0] || null,
        lastMessageAt: p.conversation.lastMessageAt,
        unreadCount: unreadById.get(p.conversationId) ?? 0,
    }));

    return NextResponse.json({ conversations });
}

const startSchema = z.object({
    recipientId: z.string().min(1),
    body: z.string().min(1).max(10000),
});

/**
 * POST — start a new conversation with a recipient (or reuse the existing
 * 1:1 conversation between the two users)
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });
    }

    if (parsed.data.recipientId === session.user.id) {
        return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
    }

    // Look for an existing 1:1 conversation between these two users
    const existing = await prisma.conversation.findFirst({
        where: {
            participants: {
                every: { userId: { in: [session.user.id, parsed.data.recipientId] } },
            },
        },
        include: { participants: true },
    });

    let conversationId: string;
    if (existing && existing.participants.length === 2) {
        conversationId = existing.id;
    } else {
        const created = await prisma.conversation.create({
            data: {
                participants: {
                    create: [
                        { userId: session.user.id },
                        { userId: parsed.data.recipientId },
                    ],
                },
            },
        });
        conversationId = created.id;
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

    return NextResponse.json({ conversationId, message }, { status: 201 });
}
