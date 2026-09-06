"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, LoadFailed } from "@/core/sdk/ui";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader, useSettingsLoad } from "@/core/sdk/admin";

export default function DiscordWidgetAdminPage() {
    const t = useTranslations("discordWidget");
    const [serverId, setServerId] = useState("");
    const [saving, setSaving] = useState(false);

    // The old read swallowed every failure and left the field empty, and the
    // save button below it then wrote that empty string over the configured
    // server id.
    const { loading, failed, retry } = useSettingsLoad((settings) => {
        const value = settings.widget_discord_server_id;
        setServerId(typeof value === "string" ? value : "");
    });

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ widget_discord_server_id: serverId.trim() }),
            });
            if (!res.ok) throw new Error("save failed");
            toast.success(t("adm_saved"));
        } catch {
            toast.error(t("adm_error"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* The save is a header action. Nothing to save while the stored
                value could not be read, so it is not offered then. */}
            <AdminPageHeader
                title={t("adm_title")}
                description={t("adm_subtitle")}
                actions={loading || failed ? undefined : (
                    <Button onClick={save} disabled={saving}>
                        {saving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> {t("adm_saving")}</>
                        ) : (
                            <><Save className="w-4 h-4" /> {t("adm_save")}</>
                        )}
                    </Button>
                )}
            />

            <Card>
                <CardHeader>
                    <CardTitle>{t("adm_serverIdLabel")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : failed ? (
                        <LoadFailed onRetry={retry} />
                    ) : (
                        <>
                            <div>
                                <Label htmlFor="discord-server-id">{t("adm_serverIdLabel")}</Label>
                                <Input
                                    id="discord-server-id"
                                    value={serverId}
                                    onChange={e => setServerId(e.target.value)}
                                    placeholder={t("adm_serverIdPlaceholder")}
                                    inputMode="numeric"
                                />
                                <p className="text-xs text-muted-foreground mt-1">{t("adm_serverIdHelp")}</p>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
