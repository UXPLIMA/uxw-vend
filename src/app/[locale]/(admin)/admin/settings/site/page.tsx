"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Loader2, Check } from "lucide-react";

export default function SiteSettingsPage() {
    const t = useTranslations("admin");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        siteName: "uxwVend",
        siteDescription: "",
        serverIp: "",
        contactEmail: "",
        socialFacebook: "",
        socialInstagram: "",
        socialTwitter: "",
        socialYoutube: "",
        socialDiscord: "",
    });

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const s = data.settings || {};
                setForm({
                    siteName: s.siteName || "uxwVend",
                    siteDescription: s.siteDescription || "",
                    serverIp: s.serverIp || "",
                    contactEmail: s.contactEmail || "",
                    socialFacebook: s.socialFacebook || "",
                    socialInstagram: s.socialInstagram || "",
                    socialTwitter: s.socialTwitter || "",
                    socialYoutube: s.socialYoutube || "",
                    socialDiscord: s.socialDiscord || "",
                });
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
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                setError(t("siteSettings_saveFailed"));
                return;
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError(t("siteSettings_saveFailed"));
        } finally {
            setSaving(false);
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
            <div className="mb-8">
                <h1 className="text-xl font-semibold">{t("siteSettings_title")}</h1>
                <p className="text-muted-foreground">{t("siteSettings_subtitle")}</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
            )}

            <form onSubmit={handleSave}>
                <div className="grid lg:grid-cols-2 gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("siteSettings_general")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>{t("siteSettings_siteName")}</Label>
                                <Input
                                    value={form.siteName}
                                    onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>{t("siteSettings_description")}</Label>
                                <Textarea
                                    value={form.siteDescription}
                                    onChange={(e) => setForm({ ...form, siteDescription: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div>
                                <Label>{t("siteSettings_serverIp")}</Label>
                                <Input
                                    value={form.serverIp}
                                    onChange={(e) => setForm({ ...form, serverIp: e.target.value })}
                                    placeholder="play.example.com"
                                />
                            </div>
                            <div>
                                <Label>{t("siteSettings_contactEmail")}</Label>
                                <Input
                                    type="email"
                                    value={form.contactEmail}
                                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                                    placeholder="support@example.com"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t("siteSettings_socialLinks")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Discord</Label>
                                <Input
                                    value={form.socialDiscord}
                                    onChange={(e) => setForm({ ...form, socialDiscord: e.target.value })}
                                    placeholder="https://discord.gg/..."
                                />
                            </div>
                            <div>
                                <Label>Twitter / X</Label>
                                <Input
                                    value={form.socialTwitter}
                                    onChange={(e) => setForm({ ...form, socialTwitter: e.target.value })}
                                    placeholder="https://twitter.com/..."
                                />
                            </div>
                            <div>
                                <Label>YouTube</Label>
                                <Input
                                    value={form.socialYoutube}
                                    onChange={(e) => setForm({ ...form, socialYoutube: e.target.value })}
                                    placeholder="https://youtube.com/..."
                                />
                            </div>
                            <div>
                                <Label>Instagram</Label>
                                <Input
                                    value={form.socialInstagram}
                                    onChange={(e) => setForm({ ...form, socialInstagram: e.target.value })}
                                    placeholder="https://instagram.com/..."
                                />
                            </div>
                            <div>
                                <Label>Facebook</Label>
                                <Input
                                    value={form.socialFacebook}
                                    onChange={(e) => setForm({ ...form, socialFacebook: e.target.value })}
                                    placeholder="https://facebook.com/..."
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="mt-6">
                    <Button type="submit" disabled={saving}>
                        {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("siteSettings_saving")}</> :
                         saved ? <><Check className="w-4 h-4 mr-2" /> {t("siteSettings_saved")}</> : t("siteSettings_saveSettings")}
                    </Button>
                </div>
            </form>
        </>
    );
}
