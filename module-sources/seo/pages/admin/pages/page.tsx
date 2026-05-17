"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, X, Search, Globe, EyeOff } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface SeoPage {
    id: string;
    path: string;
    metaTitle: string | null;
    metaDescription: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    keywords: string | null;
    canonical: string | null;
    noIndex: boolean;
    noFollow: boolean;
    structuredData: unknown;
    createdAt: string;
    updatedAt: string;
}

interface FormData {
    path: string;
    metaTitle: string;
    metaDescription: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    keywords: string;
    canonical: string;
    noIndex: boolean;
    noFollow: boolean;
}

const EMPTY_FORM: FormData = {
    path: "",
    metaTitle: "",
    metaDescription: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    keywords: "",
    canonical: "",
    noIndex: false,
    noFollow: false,
};

export default function SeoPageOverridesPage() {
    const t = useTranslations("seo");
    const [pages, setPages] = useState<SeoPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const { confirm } = useConfirm();

    const fetchPages = useCallback(async () => {
        try {
            const res = await fetch("/api/v1/seo/pages");
            const data = await res.json();
            setPages(data.pages || []);
        } catch {
            toast.error(t.has("adm_loadFailed") ? t("adm_loadFailed") : "Failed to load pages");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPages();
    }, [fetchPages]);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEdit = (page: SeoPage) => {
        setEditingId(page.id);
        setForm({
            path: page.path,
            metaTitle: page.metaTitle || "",
            metaDescription: page.metaDescription || "",
            ogTitle: page.ogTitle || "",
            ogDescription: page.ogDescription || "",
            ogImage: page.ogImage || "",
            keywords: page.keywords || "",
            canonical: page.canonical || "",
            noIndex: page.noIndex,
            noFollow: page.noFollow,
        });
        setDialogOpen(true);
    };

    const handleDelete = async (page: SeoPage) => {
        const ok = await confirm({
            title: t.has("adm_deleteTitle") ? t("adm_deleteTitle") : "Delete Page SEO",
            message: t.has("adm_deleteConfirm") ? t("adm_deleteConfirm", { path: page.path }) : `Are you sure you want to delete the SEO configuration for "${page.path}"?`,
            variant: "danger",
            confirmText: t.has("adm_delete") ? t("adm_delete") : "Delete",
        });
        if (!ok) return;

        try {
            const res = await fetch(`/api/v1/seo/pages/${page.id}`, { method: "DELETE" });
            if (!res.ok) {
                toast.error(t.has("adm_deleteFailed") ? t("adm_deleteFailed") : "Failed to delete");
                return;
            }
            toast.success(t.has("adm_deletedToast") ? t("adm_deletedToast") : "Page SEO deleted");
            fetchPages();
        } catch {
            toast.error(t.has("adm_genericError") ? t("adm_genericError") : "Something went wrong");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.path.startsWith("/")) {
            toast.error(t.has("adm_pathInvalid") ? t("adm_pathInvalid") : "Path must start with /");
            return;
        }

        setSubmitting(true);

        try {
            const url = editingId ? `/api/v1/seo/pages/${editingId}` : "/api/v1/seo/pages";
            const method = editingId ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: form.path,
                    metaTitle: form.metaTitle || null,
                    metaDescription: form.metaDescription || null,
                    ogTitle: form.ogTitle || null,
                    ogDescription: form.ogDescription || null,
                    ogImage: form.ogImage || null,
                    keywords: form.keywords || null,
                    canonical: form.canonical || null,
                    noIndex: form.noIndex,
                    noFollow: form.noFollow,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || (t.has("adm_saveFailed") ? t("adm_saveFailed") : "Failed to save"));
                return;
            }

            toast.success(editingId
                ? (t.has("adm_updatedToast") ? t("adm_updatedToast") : "Page SEO updated")
                : (t.has("adm_createdToast") ? t("adm_createdToast") : "Page SEO created"));
            setDialogOpen(false);
            fetchPages();
        } catch {
            toast.error(t.has("adm_genericError") ? t("adm_genericError") : "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    };

    const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
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
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/admin/seo">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">{t("adm_pageSeoOverrides")}</h1>
                        <p className="text-muted-foreground">{t("adm_configurePerPage")}</p>
                    </div>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="w-4 h-4 mr-2" /> {t("adm_addPage")}
                </Button>
            </div>

            {/* Pages Table */}
            {pages.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium text-foreground mb-1">{t("adm_noPageSeo")}</p>
                        <p className="text-sm text-muted-foreground mb-6">{t("adm_noPageSeoDesc")}</p>
                        <Button onClick={openCreate}>
                            <Plus className="w-4 h-4 mr-2" /> Add Page
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left p-4 font-medium text-muted-foreground">{t("adm_path")}</th>
                                        <th className="text-left p-4 font-medium text-muted-foreground">{t("adm_metaTitle")}</th>
                                        <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">{t("adm_description")}</th>
                                        <th className="text-center p-4 font-medium text-muted-foreground">{t("adm_index")}</th>
                                        <th className="text-right p-4 font-medium text-muted-foreground">{t("adm_actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pages.map((page) => (
                                        <tr key={page.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                                    <span className="font-mono text-foreground text-xs">{page.path}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-foreground max-w-[200px] truncate">
                                                {page.metaTitle || <span className="text-muted-foreground">--</span>}
                                            </td>
                                            <td className="p-4 text-muted-foreground max-w-[250px] truncate hidden md:table-cell">
                                                {page.metaDescription || "--"}
                                            </td>
                                            <td className="p-4 text-center">
                                                {page.noIndex ? (
                                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                                                        <EyeOff className="w-3 h-3" /> noindex
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                                                        indexed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => openEdit(page)}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(page)}>
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Form Dialog */}
            {dialogOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center" role="presentation">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setDialogOpen(false)} aria-hidden="true" />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
                    >
                        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-xl z-10">
                            <h2 className="text-lg font-semibold text-foreground">
                                {editingId ? t("adm_editPageSeo") : t("adm_addPageSeo")}
                            </h2>
                            <Button variant="ghost" size="icon" onClick={() => setDialogOpen(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* URL Path */}
                            <div>
                                <Label className="text-foreground">{`${t("adm_urlPath")} *`}</Label>
                                <Input
                                    value={form.path}
                                    onChange={(e) => updateField("path", e.target.value)}
                                    placeholder="/about"
                                    required
                                />
                                <p className="text-xs text-muted-foreground mt-1">Must start with / (e.g. /about, /blog/my-post)</p>
                            </div>

                            {/* Meta Tags Section */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm text-foreground">{t("adm_metaTags")}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label className="text-foreground">{t("adm_metaTitle")}</Label>
                                        <Input
                                            value={form.metaTitle}
                                            onChange={(e) => updateField("metaTitle", e.target.value)}
                                            placeholder="Page Title"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {form.metaTitle.length}/60 characters (recommended max)
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-foreground">{t("adm_metaDescription")}</Label>
                                        <textarea
                                            value={form.metaDescription}
                                            onChange={(e) => updateField("metaDescription", e.target.value)}
                                            placeholder="Brief description for search results..."
                                            rows={2}
                                            className="flex min-h-[60px] w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors duration-200"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {form.metaDescription.length}/160 characters (recommended max)
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-foreground">{t("adm_keywords")}</Label>
                                        <Input
                                            value={form.keywords}
                                            onChange={(e) => updateField("keywords", e.target.value)}
                                            placeholder="keyword1, keyword2, keyword3"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-foreground">{t("adm_canonicalUrl")}</Label>
                                        <Input
                                            value={form.canonical}
                                            onChange={(e) => updateField("canonical", e.target.value)}
                                            placeholder="https://example.com/canonical-page"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* OpenGraph Section */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm text-foreground">OpenGraph</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label className="text-foreground">OG Title</Label>
                                        <Input
                                            value={form.ogTitle}
                                            onChange={(e) => updateField("ogTitle", e.target.value)}
                                            placeholder="Title for social sharing"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-foreground">OG Description</Label>
                                        <textarea
                                            value={form.ogDescription}
                                            onChange={(e) => updateField("ogDescription", e.target.value)}
                                            placeholder="Description for social sharing..."
                                            rows={2}
                                            className="flex min-h-[60px] w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors duration-200"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-foreground">OG Image URL</Label>
                                        <Input
                                            value={form.ogImage}
                                            onChange={(e) => updateField("ogImage", e.target.value)}
                                            placeholder="https://example.com/og-image.png"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Recommended: 1200x630 pixels</p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Indexing Section */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm text-foreground">{t("adm_searchEngineDirectives")}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.noIndex}
                                            onChange={(e) => updateField("noIndex", e.target.checked)}
                                            className="w-4 h-4 rounded border-border accent-primary"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{t("adm_noIndex")}</p>
                                            <p className="text-xs text-muted-foreground">{t("adm_noIndexDesc")}</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.noFollow}
                                            onChange={(e) => updateField("noFollow", e.target.checked)}
                                            className="w-4 h-4 rounded border-border accent-primary"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{t("adm_noFollow")}</p>
                                            <p className="text-xs text-muted-foreground">{t("adm_noFollowDesc")}</p>
                                        </div>
                                    </label>
                                </CardContent>
                            </Card>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                    {t("adm_cancel")}
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("adm_saving")}</>
                                    ) : editingId ? (
                                        t("adm_update")
                                    ) : (
                                        t("adm_create")
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
