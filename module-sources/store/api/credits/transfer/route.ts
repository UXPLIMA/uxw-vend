import { NextRequest, NextResponse } from "next/server";
import { log, logActivity, prisma, rateLimitForRole, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { z } from "zod";
import { transferRefusal } from "../../../lib/credit-transfer";

/**
 * POST /api/v1/store/credits/transfer - one member sends credits to another.
 *
 * The only path where a balance leaves one account and arrives in another on
 * nobody's authority but the sender's, so the balance is checked twice. Once
 * before, to give the sender a sentence to read, and once inside the write as
 * a condition on the row, because a check before a transaction is a snapshot:
 * two sends of the whole balance arriving together both pass it and the
 * account goes negative.
 *
 * The conditional decrement is what actually protects the money. If it
 * matches no row the transfer never happened, and nothing else in the
 * transaction has run.
 */
const transferSchema = z.object({
    to: z.string().min(1).max(64),
    amount: z.number(),
    note: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Moving money between accounts, so a budget rather than a generous one.
    const rl = await rateLimitForRole(
        `credits-transfer:${session.user.id}`,
        { maxRequests: 10, windowMs: 15 * 60 * 1000 },
        session.user.role,
    );
    if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { to, amount, note } = parsed.data;

    // By username or by id, because a sender knows the name and not the id.
    const recipient = await prisma.user.findFirst({
        where: { OR: [{ id: to }, { username: to }] },
        select: { id: true, username: true },
    });
    if (!recipient) {
        return NextResponse.json(
            { error: "No account by that name", code: "credits_no_recipient" },
            { status: 404 },
        );
    }

    const sender = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { creditBalance: true, username: true },
    });

    const decision = transferRefusal({
        fromUserId: session.user.id,
        toUserId: recipient.id,
        amount,
        balance: Number(sender?.creditBalance ?? 0),
    });

    if ("refuse" in decision) {
        return NextResponse.json(
            { error: "That transfer cannot be made", code: `credits_${decision.refuse.replace(/-/g, "_")}` },
            { status: 400 },
        );
    }

    const sent = decision.send;

    try {
        const moved = await prisma.$transaction(async (tx) => {
            // The condition is the whole protection: no row matches when the
            // balance has moved since it was read, and the rest never runs.
            const taken = await tx.user.updateMany({
                where: { id: session.user.id, creditBalance: { gte: sent } },
                data: { creditBalance: { decrement: sent } },
            });
            if (taken.count === 0) return false;

            await tx.user.update({
                where: { id: recipient.id },
                data: { creditBalance: { increment: sent } },
            });
            await tx.creditTransaction.createMany({
                data: [
                    {
                        userId: session.user.id,
                        amount: -sent,
                        type: "transfer_out",
                        description: `Sent ${sent} credits to ${recipient.username}`,
                    },
                    {
                        userId: recipient.id,
                        amount: sent,
                        type: "transfer_in",
                        description: `Received ${sent} credits from ${sender?.username ?? "a member"}`,
                    },
                ],
            });
            return true;
        });

        if (!moved) {
            return NextResponse.json(
                { error: "That transfer cannot be made", code: "credits_insufficient_balance" },
                { status: 400 },
            );
        }
    } catch (err) {
        log.error("[store] a credit transfer failed", {
            from: session.user.id,
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ error: "That transfer could not be made" }, { status: 500 });
    }

    await logActivity({
        userId: session.user.id,
        action: "store.credits.transferred",
        entity: "user",
        entityId: recipient.id,
        metadata: { amount: sent, note: note ?? null },
    }).catch(() => {});

    const after = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { creditBalance: true },
    });

    return NextResponse.json(
        { sent, to: recipient.username, balance: Number(after?.creditBalance ?? 0) },
        { headers: { "Cache-Control": "private, no-store" } },
    );
}
