import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { z } from "zod";
import { KNOWN_EVENTS, isKnownEvent } from "../../lib/events";
import { embedRefusal } from "../../lib/embed-limits";
import { isDiscordWebhook } from "../../lib/discord";

/**
 * The events, and the message an operator designed for each.
 *
 * The limits are checked here rather than only when a message goes out. An
 * embed the service will refuse fails silently on a live event - a 400 with no
 * body, at three in the morning, about an order somebody placed - and the
 * operator finds out by noticing the messages stopped.
 */
const messageSchema = z.object({
    event: z.string().min(1).max(100),
    isActive: z.boolean().default(true),
    webhookUrl: z.string().max(500).optional().nullable(),
    title: z.string().max(1000).optional().nullable(),
    description: z.string().max(8000).optional().nullable(),
    color: z.number().int().min(0).max(0xffffff).optional().nullable(),
    footer: z.string().max(4000).optional().nullable(),
    fields: z.array(z.object({
        name: z.string().max(1000),
        value: z.string().max(4000),
        inline: z.boolean().optional(),
    })).max(50).optional(),
});

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const messages = await prisma.discordEventMessage.findMany({ take: 200 });
    const byEvent = new Map(messages.map((message) => [message.event, message]));

    return NextResponse.json(
        {
            events: KNOWN_EVENTS.map((known) => ({
                ...known,
                message: byEvent.get(known.event) ?? null,
            })),
        },
        { headers: { "Cache-Control": "private, no-store" } },
    );
}

export async function PUT(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { event, fields, ...rest } = parsed.data;

    // An event nobody listens for is a message nobody sends.
    if (!isKnownEvent(event)) {
        return NextResponse.json(
            { error: "Nothing here listens for that", code: "discord_unknown_event" },
            { status: 400 },
        );
    }

    /*
     * The service's limits, before this is saved rather than when it is sent.
     * The one an operator cannot find is the total across every part: each box
     * is inside its own limit, the preview looks right, and the message never
     * arrives.
     *
     * Measured on what they wrote, with the placeholders still in it. A value
     * substituted later is longer than `{player}` more often than it is
     * shorter, so this is the floor rather than the ceiling - which is why the
     * send checks again.
     */
    const refusal = embedRefusal({
        title: rest.title ?? undefined,
        description: rest.description ?? undefined,
        footer: rest.footer ? { text: rest.footer } : undefined,
        fields: fields ?? [],
    });
    if (refusal) {
        return NextResponse.json(
            { error: "That message is too long to send", code: "discord_embed_too_long", ...refusal },
            { status: 400 },
        );
    }

    /*
     * The address, here as well as when it sends. The sender refuses one that
     * is not the service's own, so storing it succeeded and nothing ever
     * arrived: an operator typed it, got a green tick, and found out by
     * noticing the channel was quiet.
     */
    const webhookUrl = rest.webhookUrl?.trim() || null;
    if (webhookUrl && !isDiscordWebhook(webhookUrl)) {
        return NextResponse.json(
            { error: "That address is not one of the service's own", code: "discord_bad_webhook" },
            { status: 400 },
        );
    }

    const message = await prisma.discordEventMessage.upsert({
        where: { event },
        create: { event, ...rest, webhookUrl, fields: fields ?? [] },
        update: { ...rest, webhookUrl, fields: fields ?? [] },
    });

    return NextResponse.json({ message });
}
