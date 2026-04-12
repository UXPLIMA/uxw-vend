"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Loader2, Check, ChevronDown, Globe, Share2, ShieldCheck, Bot, FileText } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface SeoGlobal {
    seo_default_title: string;
    seo_title_template: string;
    seo_default_description: string;
    seo_default_og_image: string;
    seo_google_verification: string;
    seo_bing_verification: string;
    seo_robots_directive: string;
    seo_canonical_url: string;
}

const DEFAULT_GLOBAL: SeoGlobal = {
    seo_default_title: "",
    seo_title_template: "",
    seo_default_description: "",
    seo_default_og_image: "",
    seo_google_verification: "",
    seo_bing_verification: "",
    seo_robots_directive: "",
    seo_canonical_url: "",
};

function CollapsibleSection({
    title,
    description,
    icon: Icon,
    defaultOpen = false,
    children,
}: {
    title: string;
    description: string;
    icon: React.ElementType;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <Card>
            <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setOpen(!open)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                        </div>
                    </div>
                    <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                            open ? "rotate-180" : ""
                        }`}
                    />
                </div>
            </CardHeader>
            {open && <CardContent className="pt-0 space-y-4">{children}</CardContent>}
        </Card>
    );
}

export default function SeoPage() {
    const t = useTranslations("admin");

    const corePages = [{ key: "home", label: t("seo_homepage") }];

    const [pages, setPages] = useState(corePages);
    const [seo, setSeo] = useState<Record<string, { title: string; description: string }>>({});
    const [global, setGlobal] = useState<SeoGlobal>(DEFAULT_GLOBAL);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch("/api/v1/settings").then((r) => r.json()),
            fetch("/api/v1/modules")
                .then((r) => r.json())
                .catch(() => ({ modules: [] })),
        ])
            .then(([settingsData, modulesData]) => {
                const enabledModules = (modulesData.modules || []).filter(
                    (m: { enabled: boolean }) => m.enabled
                );
                const modulePages = enabledModules.map((m: { id: string; name: string }) => ({
                    key: m.id,
                    label: m.name,
                }));
                const allPages = [...corePages, ...modulePages];
                setPages(allPages);

                const s = settingsData.settings || {};

                // Per-page SEO
                const seoData: Record<string, { title: string; description: string }> = {};
                allPages.forEach((p) => {
                    seoData[p.key] = {
                        title: (s[`seo_${p.key}_title`] as string) || "",
                        description: (s[`seo_${p.key}_description`] as string) || "",
                    };
                });
                setSeo(seoData);

                // Global SEO settings
                setGlobal({
                    seo_default_title: (s.seo_default_title as string) || "",
                    seo_title_template: (s.seo_title_template as string) || "",
                    seo_default_description: (s.seo_default_description as string) || "",
                    seo_default_og_image: (s.seo_default_og_image as string) || "",
                    seo_google_verification: (s.seo_google_verification as string) || "",
                    seo_bing_verification: (s.seo_bing_verification as string) || "",
                    seo_robots_directive: (s.seo_robots_directive as string) || "",
                    seo_canonical_url: (s.seo_canonical_url as string) || "",
                });

                setLoading(false);
            })
            .catch(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateGlobal = useCallback(
        (key: keyof SeoGlobal, value: string) => {
            setGlobal((prev) => ({ ...prev, [key]: value }));
        },
        []
    );

    const save = async () => {
        setSaving(true);
        const payload: Record<string, string> = {};

        // Per-page SEO
        Object.entries(seo).forEach(([key, val]) => {
            payload[`seo_${key}_title`] = val.title;
            payload[`seo_${key}_description`] = val.description;
        });

        // Global settings
        Object.entries(global).forEach(([key, val]) => {
            payload[key] = val;
        });

        await fetch("/api/v1/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        toast.success(t("seo_saved"));
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{t("seo_title")}</h1>
                <p className="text-muted-foreground">{t("seo_subtitle")}</p>
            </div>

            <div className="space-y-4">
                {/* Global Meta Tags */}
                <CollapsibleSection
                    title={t("seo_globalMeta")}
                    description={t("seo_globalMetaDesc")}
                    icon={Globe}
                    defaultOpen
                >
                    <div>
                        <Label className="text-xs">{t("seo_defaultTitle")}</Label>
                        <Input
                            value={global.seo_default_title}
                            onChange={(e) => updateGlobal("seo_default_title", e.target.value)}
                            placeholder="My Awesome Site"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t("seo_defaultTitleHint")}
                        </p>
                    </div>
                    <div>
                        <Label className="text-xs">{t("seo_titleTemplate")}</Label>
                        <Input
                            value={global.seo_title_template}
                            onChange={(e) => updateGlobal("seo_title_template", e.target.value)}
                            placeholder="%s | My Site"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t("seo_titleTemplateHint")}
                        </p>
                    </div>
                    <div>
                        <Label className="text-xs">{t("seo_defaultDescription")}</Label>
                        <Textarea
                            value={global.seo_default_description}
                            onChange={(e) =>
                                updateGlobal("seo_default_description", e.target.value)
                            }
                            placeholder={t("seo_placeholder")}
                            rows={3}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t("seo_defaultDescriptionHint")}
                        </p>
                    </div>
                </CollapsibleSection>

                {/* OpenGraph Defaults */}
                <CollapsibleSection
                    title={t("seo_openGraph")}
                    description={t("seo_openGraphDesc")}
                    icon={Share2}
                >
                    <div>
                        <Label className="text-xs">{t("seo_ogImage")}</Label>
                        <Input
                            value={global.seo_default_og_image}
                            onChange={(e) =>
                                updateGlobal("seo_default_og_image", e.target.value)
                            }
                            placeholder="https://example.com/og-image.png"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t("seo_ogImageHint")}
                        </p>
                    </div>
                </CollapsibleSection>

                {/* Search Engine Verification */}
                <CollapsibleSection
                    title={t("seo_verification")}
                    description={t("seo_verificationDesc")}
                    icon={ShieldCheck}
                >
                    <div>
                        <Label className="text-xs">{t("seo_googleVerification")}</Label>
                        <Input
                            value={global.seo_google_verification}
                            onChange={(e) =>
                                updateGlobal("seo_google_verification", e.target.value)
                            }
                            placeholder="google-site-verification=..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t("seo_googleVerificationHint")}
                        </p>
                    </div>
                    <div>
                        <Label className="text-xs">{t("seo_bingVerification")}</Label>
                        <Input
                            value={global.seo_bing_verification}
                            onChange={(e) =>
                                updateGlobal("seo_bing_verification", e.target.value)
                            }
                            placeholder="msvalidate.01=..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t("seo_bingVerificationHint")}
                        </p>
                    </div>
                </CollapsibleSection>

                {/* Robots / Indexing */}
                <CollapsibleSection
                    title={t("seo_robotsIndexing")}
                    description={t("seo_robotsIndexingDesc")}
                    icon={Bot}
                >
                    <div>
                        <Label className="text-xs">{t("seo_robotsDirective")}</Label>
                        <Input
                            value={global.seo_robots_directive}
                            onChange={(e) =>
                                updateGlobal("seo_robots_directive", e.target.value)
                            }
                            placeholder="index, follow"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t("seo_robotsDirectiveHint")}
                        </p>
                    </div>
                    <div>
                        <Label className="text-xs">{t("seo_canonicalUrl")}</Label>
                        <Input
                            value={global.seo_canonical_url}
                            onChange={(e) =>
                                updateGlobal("seo_canonical_url", e.target.value)
                            }
                            placeholder="https://example.com"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t("seo_canonicalUrlHint")}
                        </p>
                    </div>
                </CollapsibleSection>

                {/* Page-level SEO Overrides */}
                <CollapsibleSection
                    title={t("seo_pageOverrides")}
                    description={t("seo_pageOverridesDesc")}
                    icon={FileText}
                >
                    <div className="space-y-4">
                        {pages.map((page) => (
                            <div
                                key={page.key}
                                className="rounded-lg border border-border p-4 space-y-2"
                            >
                                <p className="text-sm font-medium text-foreground">
                                    {page.label}
                                </p>
                                <div>
                                    <Label className="text-xs">{t("seo_metaTitle")}</Label>
                                    <Input
                                        value={seo[page.key]?.title || ""}
                                        onChange={(e) =>
                                            setSeo({
                                                ...seo,
                                                [page.key]: {
                                                    ...seo[page.key],
                                                    title: e.target.value,
                                                },
                                            })
                                        }
                                        placeholder={`${page.label} | uxwVend`}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">
                                        {t("seo_metaDescription")}
                                    </Label>
                                    <Textarea
                                        value={seo[page.key]?.description || ""}
                                        onChange={(e) =>
                                            setSeo({
                                                ...seo,
                                                [page.key]: {
                                                    ...seo[page.key],
                                                    description: e.target.value,
                                                },
                                            })
                                        }
                                        placeholder={t("seo_placeholder")}
                                        rows={2}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </CollapsibleSection>
            </div>

            <div className="mt-6">
                <Button onClick={save} disabled={saving}>
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />{" "}
                            {t("seo_saving")}
                        </>
                    ) : (
                        <>
                            <Check className="w-4 h-4 mr-2" /> {t("seo_saveSeo")}
                        </>
                    )}
                </Button>
            </div>
        </>
    );
}
