"use client";


import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useState } from "react";
import { Link } from "@/core/sdk/navigation";
import { Button, Card, CardContent, Input, Label, LoadFailed, buttonClassName } from "@/core/sdk/ui";
import { ArrowLeft, Loader2, Check, Send } from "lucide-react";
import { AdminPageHeader, useSettingsLoad } from "@/core/sdk/admin";

const webhookEvents = [
    { key: "discord_webhook_general", labelKey: "adm_evt_general", descKey: "adm_evt_general_desc" },
    { key: "discord_webhook_order_completed", labelKey: "adm_evt_orderCompleted", descKey: "adm_evt_orderCompleted_desc" },
    { key: "discord_webhook_order_created", labelKey: "adm_evt_orderCreated", descKey: "adm_evt_orderCreated_desc" },
    { key: "discord_webhook_ticket_created", labelKey: "adm_evt_ticketCreated", descKey: "adm_evt_ticketCreated_desc" },
    { key: "discord_webhook_user_registered", labelKey: "adm_evt_userRegistered", descKey: "adm_evt_userRegistered_desc" },
    { key: "discord_webhook_forum_topic_created", labelKey: "adm_evt_forumTopic", descKey: "adm_evt_forumTopic_desc" },
    { key: "discord_webhook_blog_article_created", labelKey: "adm_evt_blogArticle", descKey: "adm_evt_blogArticle_desc" },
];

/*
 * These keys are not decoration: `sendDiscordWebhook(event)` looks up
 * `discord_webhook_${event}` and falls back to the general one, so an event
 * with no row here is an event an operator cannot route anywhere. A blog
 * article was such an event - the listener posted it, and every site that had
 * set a general webhook got articles in whichever channel it pointed at, with
 * no way to send them somewhere else.
 *
 * `a-discord-event-can-be-routed.test.ts` holds the two lists together.
 */

/** The header's submit button points at the form by id; they are the same form. */
const FORM_ID = "discord-webhooks-form";

export default function DiscordSettingsPage() {
    const t = useTranslations("discordIntegration");
    const commonT = useTranslations("common");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [webhooks, setWebhooks] = useState<Record<string, string>>({});

    // Every webhook falls back to the empty string, so a failed read showed
    // a form of empty fields and saving it deleted every configured webhook.
    const { loading, failed, retry } = useSettingsLoad((s) => {
        const wh: Record<string, string> = {};
        for (const event of webhookEvents) {
            wh[event.key] = (s[event.key] as string) || "";
        }
        setWebhooks(wh);
    });

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
                setError(commonT("somethingWentWrong"));
                return;
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError(commonT("somethingWentWrong"));
        } finally {
            setSaving(false);
        }
    };

    const testWebhook = async (key: string) => {
        const url = webhooks[key];
        if (!url) return;

        setTesting(key);
        try {
            const res = await fetch(url, {
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
            // A test that says nothing is not a test. Discord answers 204 on
            // success and 401 on a URL that has been revoked, which is exactly
            // what the admin pressed this button to find out.
            if (res.ok) toast.success(t("testSuccess"));
            else toast.error(t("testError"));
        } catch {
            // The browser blocked the cross-origin call, which says nothing
            // about the webhook: the server sends the real ones.
            toast.info(t("testBlocked"));
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

    if (failed) {
        return (
            <>
                <AdminPageHeader
                    title={t("adm_discordWebhooks")}
                    description={t("adm_webhooksSubtitle")}
                    backHref="/admin/settings/general"
                    backLabel={commonT("back")}
                />
                <Card><CardContent><LoadFailed onRetry={retry} /></CardContent></Card>
            </>
        );
    }

    return (
        <>
            {/* The save is a header action, beside the way back, rather than
                between the last webhook card and the help box. */}
            <AdminPageHeader
                title={t("adm_discordWebhooks")}
                description={t("adm_webhooksSubtitle")}
                backHref="/admin/settings/general"
                backLabel={commonT("back")}
                actions={<>
                    <Link href="/admin/discord/messages" className={buttonClassName("outline", "default")}>
                        {t("adm_msgTitle")}
                    </Link>
                    <Button type="submit" form={FORM_ID} disabled={saving}>
                        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("adm_saving")}</> :
                         saved ? <><Check className="w-4 h-4" /> {t("adm_saved")}</> : t("adm_saveWebhooks")}
                    </Button>
                </>}
            />

            {error && (
                <div role="alert" className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
            )}

            <form id={FORM_ID} onSubmit={handleSave}>
                <div className="space-y-4">
                    {webhookEvents.map((event) => (
                        <Card key={event.key}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                        <Label className="font-medium">{t(event.labelKey)}</Label>
                                        <p className="text-xs text-muted-foreground mb-2">{t(event.descKey)}</p>
                                        <Input
                                            aria-label={t(event.labelKey)}
                                            value={webhooks[event.key]}
                                            onChange={(e) => setWebhooks({ ...webhooks, [event.key]: e.target.value })}
                                            placeholder="https://discord.com/api/webhooks/..."
                                        />
                                    </div>
                                    {webhooks[event.key] && (
                                        <Button
                                            aria-label={t("testWebhook")}
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

            </form>

            <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                    <strong>{t("adm_howToGetWebhook")}</strong> {t("adm_howToGetWebhookBody")}
                </p>
            </div>
        </>
    );
}
