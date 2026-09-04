import { describe, it, expect } from "vitest";
import {
    GENERIC_CHANNEL,
    buildWebhookPayload,
    listWebhookChannels,
    resolveWebhookChannel,
    validateWebhookUrl,
    type ModuleWebhookChannel,
    type WebhookAlert,
} from "@/core/lib/webhook-channels";

const discord: ModuleWebhookChannel = {
    id: "discord",
    label: "Discord",
    layout: "embed",
    hosts: ["discord.com", "discordapp.com"],
    urlPlaceholder: "https://discord.com/api/webhooks/...",
    module: "discord-integration",
};

const chat: ModuleWebhookChannel = {
    id: "team-chat",
    label: "Team Chat",
    layout: "attachment",
    hosts: ["hooks.example.test"],
    module: "chat-integration",
};

const alert: WebhookAlert = {
    title: "Health: down",
    message: "Platform is DOWN.",
    color: 0xdc2626,
    fields: [
        { name: "Status", value: "down" },
        { name: "Version", value: "1.2.3" },
    ],
    timestamp: "2026-08-30T22:00:00.000Z",
};

describe("listWebhookChannels", () => {
    it("always offers the built-in generic channel", () => {
        expect(listWebhookChannels([], () => true)).toEqual([GENERIC_CHANNEL]);
    });

    it("adds channels from enabled modules, generic first", () => {
        const channels = listWebhookChannels([discord, chat], () => true);
        expect(channels.map((c) => c.id)).toEqual(["generic", "discord", "team-chat"]);
    });

    it("hides channels whose module is disabled", () => {
        const channels = listWebhookChannels([discord, chat], (m) => m === "chat-integration");
        expect(channels.map((c) => c.id)).toEqual(["generic", "team-chat"]);
    });

    it("keeps the first declaration when two modules claim the same channel id", () => {
        const rival: ModuleWebhookChannel = { ...discord, module: "other", label: "Rival" };
        const channels = listWebhookChannels([discord, rival], () => true);
        expect(channels).toHaveLength(2);
        expect(channels[1].label).toBe("Discord");
    });

    it("never lets a module shadow the generic channel", () => {
        const impostor: ModuleWebhookChannel = { ...discord, id: "generic", label: "Hijack" };
        const channels = listWebhookChannels([impostor], () => true);
        expect(channels).toEqual([GENERIC_CHANNEL]);
    });
});

describe("resolveWebhookChannel", () => {
    it("returns the named channel", () => {
        const channels = listWebhookChannels([discord], () => true);
        expect(resolveWebhookChannel("discord", channels).layout).toBe("embed");
    });

    it("falls back to generic when the configured channel is gone", () => {
        // The admin picked a module channel, then the module was uninstalled.
        expect(resolveWebhookChannel("discord", [GENERIC_CHANNEL])).toEqual(GENERIC_CHANNEL);
        expect(resolveWebhookChannel(undefined, [GENERIC_CHANNEL])).toEqual(GENERIC_CHANNEL);
    });
});

describe("validateWebhookUrl", () => {
    const channels = listWebhookChannels([discord], () => true);
    const dc = resolveWebhookChannel("discord", channels);

    it("accepts a URL on one of the channel's hosts", () => {
        expect(validateWebhookUrl(dc, "https://discord.com/api/webhooks/1/x").ok).toBe(true);
        expect(validateWebhookUrl(dc, "https://ptb.discord.com/api/webhooks/1/x").ok).toBe(true);
    });

    it("rejects a lookalike host", () => {
        expect(validateWebhookUrl(dc, "https://evildiscord.com/x").ok).toBe(false);
        expect(validateWebhookUrl(dc, "https://discord.com.attacker.test/x").ok).toBe(false);
    });

    it("requires https", () => {
        expect(validateWebhookUrl(dc, "http://discord.com/x").ok).toBe(false);
        expect(validateWebhookUrl(GENERIC_CHANNEL, "http://example.test/hook").ok).toBe(false);
    });

    it("rejects a malformed or empty URL", () => {
        expect(validateWebhookUrl(GENERIC_CHANNEL, "").ok).toBe(false);
        expect(validateWebhookUrl(GENERIC_CHANNEL, "not a url").ok).toBe(false);
    });

    it("accepts any public https host on the generic channel", () => {
        expect(validateWebhookUrl(GENERIC_CHANNEL, "https://hooks.example.test/services/x").ok).toBe(true);
    });

    it("blocks internal targets on the generic channel", () => {
        for (const url of [
            "https://localhost/hook",
            "https://127.0.0.1/hook",
            "https://[::1]/hook",
            "https://10.0.0.5/hook",
            "https://192.168.1.10/hook",
            "https://172.16.4.4/hook",
            "https://169.254.169.254/latest/meta-data",
            "https://intranet/hook",
            "https://db.internal/hook",
            "https://printer.local/hook",
        ]) {
            expect(validateWebhookUrl(GENERIC_CHANNEL, url), url).toMatchObject({ ok: false });
        }
    });

    /**
     * `[::ffff:127.0.0.1]` reaches the loopback the same way `127.0.0.1`
     * does, and the URL parser normalizes it to `::ffff:7f00:1`, which looks
     * nothing like the IPv6 prefixes the check knew about. The mapped address
     * is unpacked and run through the IPv4 rules now.
     */
    it("blocks an internal target written as an IPv4-mapped IPv6 literal", () => {
        for (const url of [
            "https://[::ffff:127.0.0.1]/hook",
            "https://[::ffff:7f00:1]/hook",
            "https://[::ffff:169.254.169.254]/latest/meta-data",
            "https://[::ffff:10.0.0.5]/hook",
            "https://[::ffff:192.168.1.10]/hook",
        ]) {
            expect(validateWebhookUrl(GENERIC_CHANNEL, url), url).toMatchObject({ ok: false });
        }
    });

    it("still accepts a public address in either family", () => {
        expect(validateWebhookUrl(GENERIC_CHANNEL, "https://93.184.216.34/hook").ok).toBe(true);
        expect(validateWebhookUrl(GENERIC_CHANNEL, "https://[2606:2800:220:1:248:1893:25c8:1946]/hook").ok).toBe(true);
        expect(validateWebhookUrl(GENERIC_CHANNEL, "https://[::ffff:93.184.216.34]/hook").ok).toBe(true);
    });
});

describe("buildWebhookPayload", () => {
    it("builds a neutral body for the generic layout", () => {
        const body = buildWebhookPayload(GENERIC_CHANNEL, alert);
        // `text` and `content` are both set so the same body renders on the
        // common incoming-webhook receivers without core knowing which one.
        expect(body).toMatchObject({
            title: "Health: down",
            text: "Platform is DOWN.",
            content: "Platform is DOWN.",
            timestamp: "2026-08-30T22:00:00.000Z",
        });
        expect(body.fields).toEqual(alert.fields);
    });

    it("builds an embed body", () => {
        const body = buildWebhookPayload({ ...GENERIC_CHANNEL, layout: "embed" }, alert) as {
            content: string;
            embeds: { title: string; color: number; fields: { name: string; inline: boolean }[] }[];
        };
        expect(body.content).toBe("Platform is DOWN.");
        expect(body.embeds).toHaveLength(1);
        expect(body.embeds[0].color).toBe(0xdc2626);
        expect(body.embeds[0].fields[0]).toEqual({ name: "Status", value: "down", inline: true });
    });

    it("builds an attachment body with a hex colour", () => {
        const body = buildWebhookPayload({ ...GENERIC_CHANNEL, layout: "attachment" }, alert) as {
            text: string;
            attachments: { color: string; fields: { title: string; short: boolean }[] }[];
        };
        expect(body.text).toBe("Platform is DOWN.");
        expect(body.attachments[0].color).toBe("#dc2626");
        expect(body.attachments[0].fields[0]).toEqual({ title: "Status", value: "down", short: true });
    });
});
