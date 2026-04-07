"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function SeoPage() {
    const t = useTranslations("admin");
    const corePages = [
        { key: "home", label: t("seo_homepage") },
    ];
    const [pages, setPages] = useState(corePages);
    const [seo, setSeo] = useState<Record<string, { title: string; description: string }>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch("/api/v1/settings").then((r) => r.json()),
            fetch("/api/v1/modules").then((r) => r.json()).catch(() => ({ modules: [] })),
        ]).then(([settingsData, modulesData]) => {
            const enabledModules = (modulesData.modules || []).filter((m: { enabled: boolean }) => m.enabled);
            const modulePages = enabledModules.map((m: { id: string; name: string }) => ({
                key: m.id,
                label: m.name,
            }));
            const allPages = [...corePages, ...modulePages];
            setPages(allPages);

            const s = settingsData.settings || {};
            const seoData: Record<string, { title: string; description: string }> = {};
            allPages.forEach((p) => {
                seoData[p.key] = {
                    title: (s[`seo_${p.key}_title`] as string) || "",
                    description: (s[`seo_${p.key}_description`] as string) || "",
                };
            });
            setSeo(seoData);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        const payload: Record<string, string> = {};
        Object.entries(seo).forEach(([key, val]) => {
            payload[`seo_${key}_title`] = val.title;
            payload[`seo_${key}_description`] = val.description;
        });
        await fetch("/api/v1/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        toast.success("SEO settings saved");
        setSaving(false);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{t("seo_title")}</h1>
                <p className="text-muted-foreground">{t("seo_subtitle")}</p>
            </div>

            <div className="space-y-4">
                {pages.map((page) => (
                    <Card key={page.key}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{page.label}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div>
                                <Label className="text-xs">{t("seo_metaTitle")}</Label>
                                <Input
                                    value={seo[page.key]?.title || ""}
                                    onChange={(e) => setSeo({ ...seo, [page.key]: { ...seo[page.key], title: e.target.value } })}
                                    placeholder={`${page.label} | uxwVend`}
                                />
                            </div>
                            <div>
                                <Label className="text-xs">{t("seo_metaDescription")}</Label>
                                <Textarea
                                    value={seo[page.key]?.description || ""}
                                    onChange={(e) => setSeo({ ...seo, [page.key]: { ...seo[page.key], description: e.target.value } })}
                                    placeholder={t("seo_placeholder")}
                                    rows={2}
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="mt-6">
                <Button onClick={save} disabled={saving}>
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("seo_saving")}</> : <><Check className="w-4 h-4 mr-2" /> {t("seo_saveSeo")}</>}
                </Button>
            </div>
        </>
    );
}
