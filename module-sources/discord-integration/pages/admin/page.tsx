"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { ArrowLeft, Loader2, Check, Send } from "lucide-react";

const webhookEvents = [
    { key: "discord_webhook_general", labelKey: "adm_evt_general", descKey: "adm_evt_general_desc" },
    { key: "discord_webhook_order_completed", labelKey: "adm_evt_orderCompleted", descKey: "adm_evt_orderCompleted_desc" },
    { key: "discord_webhook_order_created", labelKey: "adm_evt_orderCreated", descKey: "adm_evt_orderCreated_desc" },
    { key: "discord_webhook_ticket_created", labelKey: "adm_evt_ticketCreated", descKey: "adm_evt_ticketCreated_desc" },
    { key: "discord_webhook_user_registered", labelKey: "adm_evt_userRegistered", descKey: "adm_evt_userRegistered_desc" },
    { key: "discord_webhook_forum_topic_created", labelKey: "adm_evt_forumTopic", descKey: "adm_evt_forumTopic_desc" },
];

export default function DiscordSettingsPage() {
    const t = useTranslations("discordIntegration");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [webhooks, setWebhooks] = useState<Record<string, string>>({});

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const s = data.settings || {};
                const wh: Record<string, string> = {};
                for (const event of webhookEvents) {
                    wh[event.key] = (s[event.key] as string) || "";
                }
                setWebhooks(wh);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSaved(false);

        try {
            const res = await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(webhooks),
            });

            if (!res.ok) {
                setError("Failed to save");
                return;
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const testWebhook = async (key: string) => {
        const url = webhooks[key];
        if (!url) return;

        setTesting(key);
        try {
            await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: "uxwVend",
                    embeds: [{
                        title: "Test Notification",
                        description: "This is a test webhook from uxwVend. If you see this, your webhook is configured correctly!",
                        color: 0x22c55e,
                        timestamp: new Date().toISOString(),
                    }],
                }),
            });
        } catch {
            // CORS may block but webhook still works server-side
        } finally {
            setTesting(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/settings">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">{t("adm_discordWebhooks")}</h1>
                    <p className="text-muted-foreground">{t("adm_webhooksSubtitle")}</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
            )}

            <form onSubmit={handleSave}>
                <div className="space-y-4">
                    {webhookEvents.map((event) => (
                        <Card key={event.key}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                        <Label className="font-medium">{t(event.labelKey)}</Label>
                                        <p className="text-xs text-muted-foreground mb-2">{t(event.descKey)}</p>
                                        <Input
                                            value={webhooks[event.key]}
                                            onChange={(e) => setWebhooks({ ...webhooks, [event.key]: e.target.value })}
                                            placeholder="https://discord.com/api/webhooks/..."
                                        />
                                    </div>
                                    {webhooks[event.key] && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="mt-6"
                                            onClick={() => testWebhook(event.key)}
                                            disabled={testing === event.key}
                                        >
                                            {testing === event.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="mt-6">
                    <Button type="submit" disabled={saving}>
                        {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("adm_saving")}</> :
                         saved ? <><Check className="w-4 h-4 mr-2" /> {t("adm_saved")}</> : t("adm_saveWebhooks")}
                    </Button>
                </div>
            </form>

            <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                    <strong>{t("adm_howToGetWebhook")}</strong> In Discord, go to Server Settings → Integrations → Webhooks → New Webhook.
                    Copy the Webhook URL and paste it above. You can use different webhooks for different events, or set one general webhook for all events.
                </p>
            </div>
        </>
    );
}
