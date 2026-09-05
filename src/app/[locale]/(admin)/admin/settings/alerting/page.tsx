"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type HealthStatus = "ok" | "degraded" | "down";

interface AlertingConfig {
    enabled: boolean;
    channel: string;
    webhookUrl: string;
    alertOn: HealthStatus[];
}

/**
 * Delivery channels are supplied by the API, which builds the list from the
 * built-in generic channel plus whatever enabled modules declare. The page
 * names no vendor of its own.
 */
interface WebhookChannel {
    id: string;
    label: string;
    hosts?: string[];
    urlPlaceholder?: string;
}

const STATUSES: HealthStatus[] = ["degraded", "down"];

export default function AlertingSettingsPage() {
    const t = useTranslations("admin");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const [enabled, setEnabled] = useState(false);
    const [channels, setChannels] = useState<WebhookChannel[]>([]);
    const [channelId, setChannelId] = useState("generic");
    const [webhookUrl, setWebhookUrl] = useState("");
    const [alertOn, setAlertOn] = useState<HealthStatus[]>(["degraded", "down"]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/v1/admin/alerting");
                if (res.ok) {
                    const data = await res.json();
                    const config: AlertingConfig = data.config;
                    setChannels(data.channels ?? []);
                    setEnabled(config.enabled);
                    setChannelId(config.channel);
                    setWebhookUrl(config.webhookUrl);
                    setAlertOn(config.alertOn);
                }
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const activeChannel = channels.find((c) => c.id === channelId);

    const toggleAlertOn = (status: HealthStatus) => {
        setAlertOn((prev) =>
            prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
        );
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (alertOn.length === 0) {
            toast.error(t("alerting_selectAtLeastOne"));
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/v1/admin/alerting", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled, channel: channelId, webhookUrl, alertOn }),
            });
            if (res.ok) {
                toast.success(t("alerting_saved"));
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || t("alerting_saveFailed"));
            }
        } finally {
            setSaving(false);
        }
    };

    const sendTest = async () => {
        if (!webhookUrl) {
            toast.error(t("alerting_saveFirst"));
            return;
        }
        setTesting(true);
        try {
            const res = await fetch("/api/v1/admin/alerting/test", { method: "POST" });
            if (res.ok) {
                toast.success(t("alerting_testSent"));
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || t("alerting_testFailed"));
            }
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
            <div className="mb-6">
                <h1 className="text-3xl font-bold">
                    {t("alerting_title")}
                </h1>
                <p className="text-muted-foreground">
                    {t("alerting_subtitle")}
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("alerting_webhookTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={save} className="space-y-6">
                        <div className="flex items-center gap-3">
                            <input
                                id="enabled"
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => setEnabled(e.target.checked)}
                                className="h-4 w-4"
                            />
                            <Label htmlFor="enabled" className="cursor-pointer">
                                {t("alerting_enabled")}
                            </Label>
                        </div>

                        <div>
                            <Label>{t("alerting_channel")}</Label>
                            <div className="flex flex-wrap gap-4 mt-2">
                                {channels.map((c) => (
                                    <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="channel"
                                            value={c.id}
                                            checked={channelId === c.id}
                                            onChange={() => setChannelId(c.id)}
                                        />
                                        <span>{c.label}</span>
                                    </label>
                                ))}
                            </div>
                            {channels.length === 1 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t("alerting_channelHint")}
                                </p>
                            )}
                        </div>

                        <div>
                            <Label>{t("alerting_webhookUrl")}</Label>
                            <Input
                                aria-label={t("alerting_webhookUrl")}
                                type="url"
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                placeholder={activeChannel?.urlPlaceholder ?? "https://"}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {activeChannel?.hosts?.length
                                    ? t("alerting_hostHint") + " " + activeChannel.hosts.join(", ")
                                    : t("alerting_publicHint")}
                            </p>
                        </div>

                        <div>
                            <Label>{t("alerting_alertOn")}</Label>
                            <div className="flex gap-4 mt-2">
                                {STATUSES.map((status) => (
                                    <label key={status} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={alertOn.includes(status)}
                                            onChange={() => toggleAlertOn(status)}
                                        />
                                        <span className="capitalize">{status}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {t("alerting_alertOnHint")}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {t("alerting_saving")}
                                    </>
                                ) : (
                                    t("alerting_save")
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={testing || !webhookUrl}
                                onClick={sendTest}
                            >
                                {testing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {t("alerting_testing")}
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        {t("alerting_test")}
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </>
    );
}
