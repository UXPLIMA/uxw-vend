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

    // Compute unread count per conversation
    const conversations = await Promise.all(
        myParticipations.map(async (p) => {
            const unreadCount = p.lastReadAt
                ? await prisma.message.count({
                    where: {
                        conversationId: p.conversationId,
                        createdAt: { gt: p.lastReadAt },
                        authorId: { not: session.user.id },
                    },
                })
                : await prisma.message.count({
                    where: {
                        conversationId: p.conversationId,
                        authorId: { not: session.user.id },
                    },
                });

            return {
                id: p.conversation.id,
                title: p.conversation.title,
                participants: p.conversation.participants
                    .filter((cp: { userId: string }) => cp.userId !== session.user.id)
                    .map((cp: { user: { id: string; username: string; avatar: string | null } }) => cp.user),
                lastMessage: p.conversation.messages[0] || null,
                lastMessageAt: p.conversation.lastMessageAt,
                unreadCount,
            };
        })
    );

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
