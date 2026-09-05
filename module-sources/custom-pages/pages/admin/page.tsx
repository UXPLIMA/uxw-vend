"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { Link } from "@/core/sdk/navigation";
import { Button, Card, CardContent, Input, Label, RichTextEditor, useConfirm, useFormRoute } from "@/core/sdk/ui";
import { ArrowLeft, Loader2, Plus, Trash2, ExternalLink, Pencil, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

interface CustomPage {
    id: string;
    title: string;
    slug: string;
    isActive: boolean;
    order: number;
    createdAt: string;
}

export default function CustomPagesAdminPage() {
    const t = useTranslations("customPages");
    const commonT = useTranslations("common");
    const [pages, setPages] = useState<CustomPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { confirm } = useConfirm();

    // The editor is a screen of its own at `?form=new` or `?form=<id>`, so it
    // survives a reload and the back button closes it.
    const { showForm, editingId, formHref, openForm, closeForm } = useFormRoute();

    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [content, setContent] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [order, setOrder] = useState(0);

    const fetchPages = useCallback(async () => {
        const res = await fetch("/api/v1/custom-pages");
        if (res.ok) { const data = await res.json(); setPages(data.pages || []); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchPages(); }, [fetchPages]);

    const resetForm = () => {
        setTitle(""); setSlug(""); setContent(""); setIsActive(true); setOrder(0);
    };

    // The page the URL names is loaded once the list arrives, so opening
    // `?form=<id>` directly - or reloading it - lands on a filled editor. The
    // body is not in the list response, hence the second request.
    useEffect(() => {
        if (!editingId) { resetForm(); return; }
        const row = pages.find((page) => page.id === editingId);
        if (!row) return;
        let cancelled = false;
        fetch(`/api/v1/custom-pages/${row.slug}`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load"))))
            .then((data) => {
                if (cancelled) return;
                setTitle(data.page.title);
                setSlug(data.page.slug);
                setContent(data.page.content || "");
                setIsActive(data.page.isActive);
                setOrder(data.page.order || 0);
            })
            .catch(() => {
                // An editor that silently stays blank looks like an empty
                // page, and saving it would then wipe the real one.
                if (!cancelled) toast.error(t("adm_loadFailed"));
            });
        return () => { cancelled = true; };
    }, [editingId, pages, t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        if (editingId) {
            const res = await fetch(`/api/v1/custom-pages/${editingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content, isActive, order }),
            });
            if (res.ok) {
                toast.success(t("adm_pageUpdated"));
                await fetchPages();
                closeForm();
            } else {
                toast.error(t("adm_updateFailed"));
            }
        } else {
            const res = await fetch("/api/v1/custom-pages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, slug: slug || undefined, content, isActive, order }),
            });
            if (res.ok) {
                toast.success(t("adm_pageCreated"));
                await fetchPages();
                closeForm();
            } else {
                toast.error(t("adm_createFailed"));
            }
        }
        setSaving(false);
    };

    const deletePage = async (page: CustomPage) => {
        const ok = await confirm({
            title: t("adm_deleteTitle"),
            message: t("adm_deleteConfirm", { title: page.title }),
            variant: "danger",
            confirmText: t("adm_delete"),
        });
        if (!ok) return;
        const res = await fetch(`/api/v1/custom-pages/${page.slug}`, { method: "DELETE" });
        if (res.ok) {
            toast.success(t("adm_pageDeleted"));
            fetchPages();
        } else {
            toast.error(t("adm_deleteFailed"));
        }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    if (showForm) {
        return (
            <>
                <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-bold">{editingId ? t("adm_editPage") : t("adm_createPage")}</h1>
                        <p className="text-muted-foreground">{t("adm_customPagesSubtitle")}</p>
                    </div>
                    <Button variant="outline" onClick={closeForm}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> {commonT("back")}
                    </Button>
                </div>

                <Card>
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>{`${t("adm_title")} *`}</Label>
                                    <Input aria-label={t("adm_title")} value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={t("adm_pageTitle")} />
                                </div>
                                {!editingId && (
                                    <div>
                                        <Label>{t("adm_slugOptional")}</Label>
                                        <Input aria-label={t("adm_slugOptional")} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated-from-title" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <Label>{`${t("adm_contentHtml")} *`}</Label>
                                <RichTextEditor value={content} onChange={setContent} />
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                                    {t("adm_published")}
                                </label>
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm">{t("adm_sortOrder")}</Label>
                                    <Input aria-label={t("adm_sortOrder")} type="number" className="w-20" value={order} onChange={(e) => setOrder(parseInt(e.target.value) || 0)} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" disabled={saving}>
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    {editingId ? t("adm_updatePage") : t("adm_createPage")}
                                </Button>
                                <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>
                                    {t("adm_cancel")}
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
            <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold">{t("adm_customPages")}</h1>
                    <p className="text-muted-foreground">{t("adm_customPagesSubtitle")}</p>
                </div>
                <Link href={formHref()} className="inline-flex">
                    <Button><Plus className="w-4 h-4 mr-2" /> {t("adm_newPage")}</Button>
                </Link>
            </div>

            {pages.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">{t("adm_noPagesYet")}</CardContent></Card>
            ) : (
                <div className="space-y-2">
                    {pages.map((page) => (
                        <Card key={page.id}>
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <h2 className="font-medium text-foreground">{page.title}</h2>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <ExternalLink className="w-3 h-3" /> /page/{page.slug}
                                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${page.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                                            {page.isActive ? t("adm_published") : t("adm_draft")}
                                        </span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Link href={`/admin/custom-pages/builder/${page.id}`}>
                                        <Button variant="ghost" size="sm" title={t("adm_openInBuilder")}>
                                            <LayoutDashboard className="w-3 h-3" />
                                        </Button>
                                    </Link>
                                    <Button variant="ghost" size="sm" onClick={() => openForm(page.id)} title={t("adm_htmlEditor")}><Pencil className="w-3 h-3" /></Button>
                                    <Button aria-label={commonT("delete")} variant="ghost" size="sm" className="text-destructive" onClick={() => deletePage(page)}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </>
    );
}
