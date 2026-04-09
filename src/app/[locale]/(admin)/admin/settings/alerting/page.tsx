"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Bell, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type Provider = "discord" | "slack";
type HealthStatus = "ok" | "degraded" | "down";

interface AlertingConfig {
    enabled: boolean;
    provider: Provider;
    webhookUrl: string;
    alertOn: HealthStatus[];
}

const STATUSES: HealthStatus[] = ["degraded", "down"];

export default function AlertingSettingsPage() {
    const t = useTranslations("admin");
    const fallback = (key: string, en: string) => (t.has(key) ? t(key) : en);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const [enabled, setEnabled] = useState(false);
    const [provider, setProvider] = useState<Provider>("discord");
    const [webhookUrl, setWebhookUrl] = useState("");
    const [alertOn, setAlertOn] = useState<HealthStatus[]>(["degraded", "down"]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/v1/admin/alerting");
                if (res.ok) {
                    const data = await res.json();
                    const config: AlertingConfig = data.config;
                    setEnabled(config.enabled);
                    setProvider(config.provider);
                    setWebhookUrl(config.webhookUrl);
                    setAlertOn(config.alertOn);
                }
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const toggleAlertOn = (status: HealthStatus) => {
        setAlertOn((prev) =>
            prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
        );
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (alertOn.length === 0) {
            toast.error(fallback("alerting_selectAtLeastOne", "Select at least one status to alert on."));
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/v1/admin/alerting", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled, provider, webhookUrl, alertOn }),
            });
            if (res.ok) {
                toast.success(fallback("alerting_saved", "Alerting settings saved."));
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || fallback("alerting_saveFailed", "Failed to save."));
            }
        } finally {
            setSaving(false);
        }
    };

    const sendTest = async () => {
        if (!webhookUrl) {
            toast.error(fallback("alerting_saveFirst", "Save a webhook URL first."));
            return;
        }
        setTesting(true);
        try {
            const res = await fetch("/api/v1/admin/alerting/test", { method: "POST" });
            if (res.ok) {
                toast.success(fallback("alerting_testSent", "Test notification sent."));
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || fallback("alerting_testFailed", "Test failed."));
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
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Bell className="w-7 h-7" />
                    {fallback("alerting_title", "Health Alerting")}
                </h1>
                <p className="text-muted-foreground">
                    {fallback(
                        "alerting_subtitle",
                        "Send a Discord or Slack notification when /api/health goes degraded or down.",
                    )}
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{fallback("alerting_webhookTitle", "Webhook configuration")}</CardTitle>
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
                                {fallback("alerting_enabled", "Enable health alerting")}
                            </Label>
                        </div>

                        <div>
                            <Label>{fallback("alerting_provider", "Provider")}</Label>
                            <div className="flex gap-4 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="provider"
                                        value="discord"
                                        checked={provider === "discord"}
                                        onChange={() => setProvider("discord")}
                                    />
                                    <span>Discord</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="provider"
                                        value="slack"
                                        checked={provider === "slack"}
                                        onChange={() => setProvider("slack")}
                                    />
                                    <span>Slack</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <Label>{fallback("alerting_webhookUrl", "Webhook URL")}</Label>
                            <Input
                                type="url"
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                placeholder={
                                    provider === "discord"
                                        ? "https://discord.com/api/webhooks/..."
                                        : "https://hooks.slack.com/services/..."
                                }
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {provider === "discord"
                                    ? fallback("alerting_discordHint", "Must be a discord.com webhook URL.")
                                    : fallback("alerting_slackHint", "Must be a slack.com webhook URL.")}
                            </p>
                        </div>

                        <div>
                            <Label>{fallback("alerting_alertOn", "Alert on these statuses")}</Label>
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
                                {fallback(
                                    "alerting_alertOnHint",
                                    "Recovery ('ok' after a bad state) is always sent.",
                                )}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {fallback("alerting_saving", "Saving...")}
                                    </>
                                ) : (
                                    fallback("alerting_save", "Save")
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
                                        {fallback("alerting_testing", "Sending...")}
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        {fallback("alerting_test", "Test webhook")}
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
