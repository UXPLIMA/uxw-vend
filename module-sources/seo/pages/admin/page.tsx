"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Search, Loader2, Check, FileText, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface SeoSettings {
    seo_default_title: string;
    seo_title_template: string;
    seo_default_description: string;
    seo_default_og_image: string;
    seo_google_verification: string;
    seo_bing_verification: string;
}

const DEFAULT_SETTINGS: SeoSettings = {
    seo_default_title: "",
    seo_title_template: "",
    seo_default_description: "",
    seo_default_og_image: "",
    seo_google_verification: "",
    seo_bing_verification: "",
};

export default function SeoSettingsPage() {
    const t = useTranslations("seo");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [settings, setSettings] = useState<SeoSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        fetch("/api/v1/seo/settings")
            .then((r) => r.json())
            .then((data) => {
                const s = data.settings || {};
                setSettings({
                    seo_default_title: (s.seo_default_title as string) || "",
                    seo_title_template: (s.seo_title_template as string) || "",
                    seo_default_description: (s.seo_default_description as string) || "",
                    seo_default_og_image: (s.seo_default_og_image as string) || "",
                    seo_google_verification: (s.seo_google_verification as string) || "",
                    seo_bing_verification: (s.seo_bing_verification as string) || "",
                });
            })
            .catch(() => toast.error("Failed to load SEO settings"))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSaved(false);

        try {
            const res = await fetch("/api/v1/seo/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "Failed to save settings");
                return;
            }

            setSaved(true);
            toast.success("SEO settings saved");
            setTimeout(() => setSaved(false), 3000);
        } catch {
            toast.error("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = (key: keyof SeoSettings, value: string) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
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
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                        <Search className="w-5 h-5 text-teal-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">{t("adm_seoManager")}</h1>
                        <p className="text-muted-foreground">{t("adm_seoManagerSubtitle")}</p>
                    </div>
                </div>
            </div>

            {/* Page SEO Overrides Link */}
            <Link href="/admin/seo/pages">
                <Card className="mb-6 cursor-pointer hover:border-primary/50 transition-colors">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium text-foreground">{t("adm_pageSeoOverrides")}</p>
                                <p className="text-sm text-muted-foreground">{t("adm_pageSeoOverridesDesc")}</p>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </CardContent>
                </Card>
            </Link>

            {/* Global SEO Settings */}
            <form onSubmit={handleSave}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-foreground">{t("adm_globalSeoSettings")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div>
                            <Label className="text-foreground">{t("adm_defaultSiteTitle")}</Label>
                            <Input
                                value={settings.seo_default_title}
                                onChange={(e) => updateSetting("seo_default_title", e.target.value)}
                                placeholder="My Awesome Site"
                            />
                            <p className="text-xs text-muted-foreground mt-1">{t("adm_defaultSiteTitleDesc")}</p>
                        </div>

                        <div>
                            <Label className="text-foreground">{t("adm_titleTemplate")}</Label>
                            <Input
                                value={settings.seo_title_template}
                                onChange={(e) => updateSetting("seo_title_template", e.target.value)}
                                placeholder="%s | My Site"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Use %s as placeholder for the page title (e.g. &quot;%s | My Site&quot;)</p>
                        </div>

                        <div>
                            <Label className="text-foreground">{t("adm_defaultDescription")}</Label>
                            <textarea
                                value={settings.seo_default_description}
                                onChange={(e) => updateSetting("seo_default_description", e.target.value)}
                                placeholder="A brief description of your site for search engines..."
                                rows={3}
                                className="flex min-h-[80px] w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors duration-200"
                            />
                        </div>

                        <div>
                            <Label className="text-foreground">{t("adm_defaultOgImage")}</Label>
                            <Input
                                value={settings.seo_default_og_image}
                                onChange={(e) => updateSetting("seo_default_og_image", e.target.value)}
                                placeholder="https://example.com/og-image.png"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Default social sharing image (1200x630 recommended)</p>
                        </div>

                        <div className="border-t border-border pt-5">
                            <h3 className="text-sm font-semibold text-foreground mb-4">{t("adm_searchEngineVerification")}</h3>
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-foreground">{t("adm_googleVerification")}</Label>
                                    <Input
                                        value={settings.seo_google_verification}
                                        onChange={(e) => updateSetting("seo_google_verification", e.target.value)}
                                        placeholder="google-site-verification=..."
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Content value from Google Search Console verification meta tag</p>
                                </div>
                                <div>
                                    <Label className="text-foreground">{t("adm_bingVerification")}</Label>
                                    <Input
                                        value={settings.seo_bing_verification}
                                        onChange={(e) => updateSetting("seo_bing_verification", e.target.value)}
                                        placeholder="msvalidate.01=..."
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Content value from Bing Webmaster Tools verification meta tag</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-6">
                    <Button type="submit" disabled={saving}>
                        {saving ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("adm_saving")}</>
                        ) : saved ? (
                            <><Check className="w-4 h-4 mr-2" /> {t("adm_saved")}</>
                        ) : (
                            t("adm_saveSettings")
                        )}
                    </Button>
                </div>
            </form>
        </>
    );
}
