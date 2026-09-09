import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { z } from "zod";
import { KNOWN_EVENTS, isKnownEvent } from "../../lib/events";
import { embedRefusal } from "../../lib/embed-limits";
import { fillPlaceholders } from "../../lib/placeholders";
import { isDiscordWebhook, postToWebhook } from "../../lib/discord";

/**
 * POST /api/v1/discord/test-send - send the message an operator is designing.
 *
 * The point of it is to answer, so it does: the service's own words when it
 * refuses, rather than "it did not work". A message that never arrives and a
 * message that arrives wrong look identical from the admin screen, and this is
 * the only place an operator can tell them apart.
 *
 * The placeholders are filled with obvious stand-ins rather than left as they
 * were written. An operator sending a test wants to see the shape of the
 * message, and `{player} bought {product}` is not a shape.
 */
const testSchema = z.object({
    event: z.string().min(1).max(100),
});

/** What a test message stands in for. Recognisable as a stand-in on purpose. */
const SAMPLES: Record<string, string> = {
    username: "Example Member",
    email: "member@example.com",
    title: "An example title",
    author: "Example Member",
    url: "https://example.com/somewhere",
    subject: "An example subject",
    department: "General",
    orderNumber: "ORD-EXAMPLE",
    total: "10.00",
    currency: "USD",
};

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = testSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { event } = parsed.data;

    if (!isKnownEvent(event)) {
        return NextResponse.json(
            { error: "Nothing here listens for that", code: "discord_unknown_event" },
            { status: 400 },
        );
    }

    const message = await prisma.discordEventMessage.findUnique({ where: { event } });
    if (!message) {
        return NextResponse.json(
            { error: "Nothing has been written for that event yet", code: "discord_no_message" },
            { status: 400 },
        );
    }

    const known = KNOWN_EVENTS.find((entry) => entry.event === event);
    const values: Record<string, string> = {};
    for (const name of known?.placeholders ?? []) values[name] = SAMPLES[name] ?? `example ${name}`;

    const stored = Array.isArray(message.fields) ? message.fields : [];
    const embed = {
        title: message.title ? fillPlaceholders(message.title, values) : undefined,
        description: message.description ? fillPlaceholders(message.description, values) : undefined,
        color: message.color ?? undefined,
        footer: message.footer ? { text: fillPlaceholders(message.footer, values) } : undefined,
        fields: (stored as { name?: string; value?: string; inline?: boolean }[]).map((field) => ({
            name: fillPlaceholders(String(field.name ?? ""), values),
            value: fillPlaceholders(String(field.value ?? ""), values),
            inline: field.inline === true,
        })),
    };

    // Again, on what is actually going out. A value is longer than the name
    // that stood for it more often than it is shorter, so the check when it
    // was saved was the floor.
    const refusal = embedRefusal(embed);
    if (refusal) {
        return NextResponse.json(
            { error: "That message is too long to send", code: "discord_embed_too_long", ...refusal },
            { status: 400 },
        );
    }

    const url = message.webhookUrl?.trim() || null;
    if (url && !isDiscordWebhook(url)) {
        return NextResponse.json(
            { error: "That address is not one of the service's own", code: "discord_bad_webhook" },
            { status: 400 },
        );
    }

    if (!url) {
        const general = await prisma.setting.findUnique({ where: { key: "discord_webhook_general" } });
        const fallback = typeof general?.value === "string" ? general.value.trim() : "";
        if (!fallback || !isDiscordWebhook(fallback)) {
            return NextResponse.json(
                { error: "No webhook address is set up", code: "discord_no_webhook" },
                { status: 400 },
            );
        }
        const sent = await postToWebhook(fallback, { embeds: [embed] });
        return answer(sent);
    }

    return answer(await postToWebhook(url, { embeds: [embed] }));
}

/** The service's own words, or that it went. */
function answer(sent: { ok: boolean; status: number; detail: string | null }) {
    if (sent.ok) return NextResponse.json({ sent: true });
    return NextResponse.json(
        {
            error: "The service refused it",
            code: "discord_refused",
            status: sent.status,
            // Its own words: the only useful thing anybody gets when a message
            // does not arrive.
            detail: sent.detail,
        },
        { status: 502 },
    );
}
