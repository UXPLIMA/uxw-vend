"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Loader2, Check } from "lucide-react";
import { AdminPageHeader } from "@/core/components/admin/AdminPageHeader";
import { LoadFailed } from "@/core/components/ui/load-failed";
import { useSettingsLoad } from "@/core/hooks/useSettingsLoad";

/** The header's submit button points at the form by id; they are the same form. */
const FORM_ID = "site-settings-form";

export default function SiteSettingsPage() {
    const t = useTranslations("admin");
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

    // A read that failed would otherwise offer this form at its defaults, and
    // saving it renames the site to "uxwVend" and empties every social link.
    const { loading, failed, retry } = useSettingsLoad((s) => {
        setForm({
            siteName: (s.siteName as string) || "uxwVend",
            siteDescription: (s.siteDescription as string) || "",
            serverIp: (s.serverIp as string) || "",
            contactEmail: (s.contactEmail as string) || "",
            socialFacebook: (s.socialFacebook as string) || "",
            socialInstagram: (s.socialInstagram as string) || "",
            socialTwitter: (s.socialTwitter as string) || "",
            socialYoutube: (s.socialYoutube as string) || "",
            socialDiscord: (s.socialDiscord as string) || "",
        });
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

    if (failed) {
        return (
            <>
                <AdminPageHeader title={t("siteSettings_title")} description={t("siteSettings_subtitle")} />
                <Card><CardContent><LoadFailed onRetry={retry} /></CardContent></Card>
            </>
        );
    }

    return (
        <>
            {/* The page is one form, so its save is a page action: it sits in
                the header with everything else a screen offers, not under
                whichever card happens to be last. */}
            <AdminPageHeader
                title={t("siteSettings_title")}
                description={t("siteSettings_subtitle")}
                actions={
                    <Button type="submit" form={FORM_ID} disabled={saving}>
                        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("siteSettings_saving")}</> :
                         saved ? <><Check className="w-4 h-4" /> {t("siteSettings_saved")}</> : t("siteSettings_saveSettings")}
                    </Button>
                }
            />

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
            )}

            <form id={FORM_ID} onSubmit={handleSave}>
                <div className="grid lg:grid-cols-2 gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("siteSettings_general")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>{t("siteSettings_siteName")}</Label>
                                <Input
                                    aria-label={t("siteSettings_siteName")}
                                    value={form.siteName}
                                    onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>{t("siteSettings_description")}</Label>
                                <Textarea
                                    aria-label={t("siteSettings_description")}
                                    value={form.siteDescription}
                                    onChange={(e) => setForm({ ...form, siteDescription: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div>
                                <Label>{t("siteSettings_serverIp")}</Label>
                                <Input
                                    aria-label={t("siteSettings_serverIp")}
                                    value={form.serverIp}
                                    onChange={(e) => setForm({ ...form, serverIp: e.target.value })}
                                    placeholder="play.example.com"
                                />
                            </div>
                            <div>
                                <Label>{t("siteSettings_contactEmail")}</Label>
                                <Input
                                    aria-label={t("siteSettings_contactEmail")}
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
                                    aria-label="Discord"
                                    value={form.socialDiscord}
                                    onChange={(e) => setForm({ ...form, socialDiscord: e.target.value })}
                                    placeholder="https://discord.gg/..."
                                />
                            </div>
                            <div>
                                <Label>Twitter / X</Label>
                                <Input
                                    aria-label="Twitter / X"
                                    value={form.socialTwitter}
                                    onChange={(e) => setForm({ ...form, socialTwitter: e.target.value })}
                                    placeholder="https://twitter.com/..."
                                />
                            </div>
                            <div>
                                <Label>YouTube</Label>
                                <Input
                                    aria-label="YouTube"
                                    value={form.socialYoutube}
                                    onChange={(e) => setForm({ ...form, socialYoutube: e.target.value })}
                                    placeholder="https://youtube.com/..."
                                />
                            </div>
                            <div>
                                <Label>Instagram</Label>
                                <Input
                                    aria-label="Instagram"
                                    value={form.socialInstagram}
                                    onChange={(e) => setForm({ ...form, socialInstagram: e.target.value })}
                                    placeholder="https://instagram.com/..."
                                />
                            </div>
                            <div>
                                <Label>Facebook</Label>
                                <Input
                                    aria-label="Facebook"
                                    value={form.socialFacebook}
                                    onChange={(e) => setForm({ ...form, socialFacebook: e.target.value })}
                                    placeholder="https://facebook.com/..."
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </form>
        </>
    );
}
