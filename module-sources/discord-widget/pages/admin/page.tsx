"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export default function DiscordWidgetAdminPage() {
    const t = useTranslations("discordWidget");
    const [serverId, setServerId] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/v1/settings")
            .then(r => r.json())
            .then(d => {
                const value = d?.settings?.widget_discord_server_id;
                setServerId(typeof value === "string" ? value : "");
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

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
            <div>
                <h1 className="text-3xl font-bold">{t("adm_title")}</h1>
                <p className="text-muted-foreground">{t("adm_subtitle")}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("adm_serverIdLabel")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
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
                            <div className="flex justify-end">
                                <Button onClick={save} disabled={saving}>
                                    {saving ? (
                                        <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {t("adm_saving")}</>
                                    ) : (
                                        <><Save className="w-4 h-4 mr-1" /> {t("adm_save")}</>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
