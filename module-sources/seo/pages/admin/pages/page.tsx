"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Pagination, usePagedRows, useConfirm, useFormRoute, CheckboxField, Textarea, buttonClassName } from "@/core/sdk/ui";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Search, Globe, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/core/sdk/navigation";
import { AdminPageHeader } from "@/core/sdk/admin";
import { errorMessage } from "@/core/sdk";

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
    const commonT = useTranslations("common");
    const [pages, setPages] = useState<SeoPage[]>([]);
    const [loading, setLoading] = useState(true);
    // The override form used to be a modal over the table. A modal is still
    // the same screen wearing one address: it cannot be linked, reloaded or
    // closed with the back button. It is now a screen at `?form=new` or
    // `?form=<id>`.
    const { showForm, editingId, formHref, openForm, closeForm } = useFormRoute();
    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const paged = usePagedRows(pages);
    const { confirm } = useConfirm();

    const fetchPages = useCallback(async () => {
        try {
            const res = await fetch("/api/v1/seo/pages");
            const data = await res.json();
            setPages(data.pages || []);
        } catch {
            toast.error(t("adm_loadFailed"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPages();
    }, [fetchPages]);

    // The override the URL names fills the form once the rows arrive, so
    // `?form=<id>` survives a reload and can be sent to someone.
    useEffect(() => {
        if (!editingId) {
            setForm(EMPTY_FORM);
            return;
        }
        const page = pages.find((row) => row.id === editingId);
        if (!page) return;
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
    }, [editingId, pages]);

    const handleDelete = async (page: SeoPage) => {
        const ok = await confirm({
            title: t("adm_deleteTitle"),
            message: t("adm_deleteConfirm", { path: page.path }),
            variant: "danger",
            confirmText: t("adm_delete"),
        });
        if (!ok) return;

        try {
            const res = await fetch(`/api/v1/seo/pages/${page.id}`, { method: "DELETE" });
            if (!res.ok) {
                toast.error(t("adm_deleteFailed"));
                return;
            }
            toast.success(t("adm_deletedToast"));
            fetchPages();
        } catch {
            toast.error(t("adm_genericError"));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.path.startsWith("/")) {
            toast.error(t("adm_pathInvalid"));
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
                toast.error(errorMessage(data, t("adm_saveFailed"), t));
                return;
            }

            toast.success(editingId
                ? t("adm_updatedToast")
                : t("adm_createdToast"));
            await fetchPages();
            closeForm();
        } catch {
            toast.error(t("adm_genericError"));
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

    if (showForm) {
        return (
            <>
                <AdminPageHeader
                    title={editingId ? t("adm_editPageSeo") : t("adm_addPageSeo")}
                    description={t("adm_configurePerPage")}
                    onBack={closeForm}
                    backLabel={commonT("back")}
                />

                <Card>
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* URL Path */}
                            <div>
                                <Label className="text-foreground">{`${t("adm_urlPath")} *`}</Label>
                                <Input
                                    aria-label={t("adm_urlPath")}
                                    value={form.path}
                                    onChange={(e) => updateField("path", e.target.value)}
                                    placeholder="/about"
                                    required
                                />
                                <p className="text-xs text-muted-foreground mt-1">{t("adm_urlPathHelp")}</p>
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
                                            aria-label={t("adm_metaTitle")}
                                            value={form.metaTitle}
                                            onChange={(e) => updateField("metaTitle", e.target.value)}
                                            placeholder={t("adm_metaTitlePlaceholder")}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {form.metaTitle.length}/60 characters (recommended max)
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-foreground">{t("adm_metaDescription")}</Label>
                                        <Textarea
                                            aria-label={t("adm_metaDescription")}
                                            value={form.metaDescription}
                                            onChange={(e) => updateField("metaDescription", e.target.value)}
                                            placeholder={t("adm_metaDescriptionPlaceholder")}
                                            rows={2}
                                            className="min-h-[60px]"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {form.metaDescription.length}/160 characters (recommended max)
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-foreground">{t("adm_keywords")}</Label>
                                        <Input
                                            aria-label={t("adm_keywords")}
                                            value={form.keywords}
                                            onChange={(e) => updateField("keywords", e.target.value)}
                                            placeholder="keyword1, keyword2, keyword3"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-foreground">{t("adm_canonicalUrl")}</Label>
                                        <Input
                                            aria-label={t("adm_canonicalUrl")}
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
                                        <Label className="text-foreground">{t("adm_ogTitle")}</Label>
                                        <Input
                                            aria-label={t("adm_ogTitle")}
                                            value={form.ogTitle}
                                            onChange={(e) => updateField("ogTitle", e.target.value)}
                                            placeholder={t("adm_ogTitlePlaceholder")}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-foreground">{t("adm_ogDescription")}</Label>
                                        <Textarea
                                            aria-label={t("adm_ogDescription")}
                                            value={form.ogDescription}
                                            onChange={(e) => updateField("ogDescription", e.target.value)}
                                            placeholder={t("adm_ogDescriptionPlaceholder")}
                                            rows={2}
                                            className="min-h-[60px]"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-foreground">{t("adm_ogImage")}</Label>
                                        <Input
                                            aria-label={t("adm_ogImage")}
                                            value={form.ogImage}
                                            onChange={(e) => updateField("ogImage", e.target.value)}
                                            placeholder="https://example.com/og-image.png"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">{t("adm_ogImageHelp")}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Indexing Section */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm text-foreground">{t("adm_searchEngineDirectives")}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <CheckboxField
                                        checked={form.noIndex}
                                        onChange={(e) => updateField("noIndex", e.target.checked)}
                                        label={<span className="font-medium">{t("adm_noIndex")}</span>}
                                        description={t("adm_noIndexDesc")}
                                    />
                                    <CheckboxField
                                        checked={form.noFollow}
                                        onChange={(e) => updateField("noFollow", e.target.checked)}
                                        label={<span className="font-medium">{t("adm_noFollow")}</span>}
                                        description={t("adm_noFollowDesc")}
                                    />
                                </CardContent>
                            </Card>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={closeForm}>
                                    {t("adm_cancel")}
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> {t("adm_saving")}</>
                                    ) : editingId ? (
                                        t("adm_update")
                                    ) : (
                                        t("adm_create")
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </>
        );
    }

    return (
        <>
            <AdminPageHeader
                title={t("adm_pageSeoOverrides")}
                description={t("adm_configurePerPage")}
                backHref="/admin/seo"
                backLabel={commonT("back")}
                actions={
                    <Link href={formHref()} className={buttonClassName("default", "default")}><Plus className="w-4 h-4" /> {t("adm_addPage")}</Link>
                }
            />

            {/* Pages Table */}
            {pages.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium text-foreground mb-1">{t("adm_noPageSeo")}</p>
                        <p className="text-sm text-muted-foreground mb-6">{t("adm_noPageSeoDesc")}</p>
                        <Link href={formHref()} className={buttonClassName("default", "default")}><Plus className="w-4 h-4" /> {t("adm_addPage")}</Link>
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
                                    {paged.rows.map((page) => (
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
                                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
                                                        indexed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button aria-label={commonT("edit")} variant="ghost" size="icon" onClick={() => openForm(page.id)}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button aria-label={commonT("delete")} variant="ghost" size="icon" onClick={() => handleDelete(page)}>
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={paged.page} pages={paged.pages} total={paged.total} onPageChange={paged.setPage} />
                    </CardContent>
                </Card>
            )}

        </>
    );
}
