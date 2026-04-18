"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { RichTextEditor } from "@/core/components/ui/rich-text-editor";
import { Loader2, Plus, X, Trash2, ExternalLink, Pencil, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

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
    const [pages, setPages] = useState<CustomPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const { confirm } = useConfirm();

    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [content, setContent] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [order, setOrder] = useState(0);

    const fetchPages = async () => {
        const res = await fetch("/api/v1/custom-pages");
        if (res.ok) { const data = await res.json(); setPages(data.pages || []); }
        setLoading(false);
    };

    useEffect(() => { fetchPages(); }, []);

    const resetForm = () => {
        setTitle(""); setSlug(""); setContent(""); setIsActive(true); setOrder(0);
        setEditingId(null); setShowForm(false);
    };

    const startEdit = async (page: CustomPage) => {
        const res = await fetch(`/api/v1/custom-pages/${page.slug}`);
        if (!res.ok) return;
        const data = await res.json();
        setTitle(data.page.title);
        setSlug(data.page.slug);
        setContent(data.page.content || "");
        setIsActive(data.page.isActive);
        setOrder(data.page.order || 0);
        setEditingId(page.id);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        if (editingId) {
            const res = await fetch(`/api/v1/custom-pages/${editingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, content, isActive, order }),
            });
            if (res.ok) { toast.success("Page updated"); resetForm(); fetchPages(); }
            else toast.error("Failed to update page");
        } else {
            const res = await fetch("/api/v1/custom-pages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, slug: slug || undefined, content, isActive, order }),
            });
            if (res.ok) { toast.success("Page created"); resetForm(); fetchPages(); }
            else toast.error("Failed to create page");
        }
        setSaving(false);
    };

    const deletePage = async (page: CustomPage) => {
        const ok = await confirm({ title: "Delete Page", message: `Are you sure you want to delete "${page.title}"?` });
        if (!ok) return;
        const res = await fetch(`/api/v1/custom-pages/${page.slug}`, { method: "DELETE" });
        if (res.ok) { toast.success("Page deleted"); fetchPages(); }
        else toast.error("Failed to delete page");
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("adm_customPages")}</h1>
                    <p className="text-muted-foreground">{t("adm_customPagesSubtitle")}</p>
                </div>
                <Button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>
                    {showForm ? <><X className="w-4 h-4 mr-2" /> {t("adm_cancel")}</> : <><Plus className="w-4 h-4 mr-2" /> {t("adm_newPage")}</>}
                </Button>
            </div>

            {showForm && (
                <Card className="mb-6">
                    <CardHeader><CardTitle>{editingId ? t("adm_editPage") : t("adm_createPage")}</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>{`${t("adm_title")} *`}</Label>
                                    <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={t("adm_pageTitle")} />
                                </div>
                                {!editingId && (
                                    <div>
                                        <Label>{t("adm_slugOptional")}</Label>
                                        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated-from-title" />
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
                                    Published
                                </label>
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm">{t("adm_order")}</Label>
                                    <Input type="number" className="w-20" value={order} onChange={(e) => setOrder(parseInt(e.target.value) || 0)} />
                                </div>
                            </div>
                            <Button type="submit" disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {editingId ? t("adm_updatePage") : t("adm_createPage")}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {pages.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">{t("adm_noPagesYet")}</CardContent></Card>
            ) : (
                <div className="space-y-2">
                    {pages.map((page) => (
                        <Card key={page.id}>
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-foreground">{page.title}</h3>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <ExternalLink className="w-3 h-3" /> /page/{page.slug}
                                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${page.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                            {page.isActive ? t("adm_published") : t("adm_draft")}
                                        </span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Link href={`/admin/page-builder/${page.id}`}>
                                        <Button variant="ghost" size="sm" title="Open in visual builder">
                                            <LayoutDashboard className="w-3 h-3" />
                                        </Button>
                                    </Link>
                                    <Button variant="ghost" size="sm" onClick={() => startEdit(page)} title="HTML editor"><Pencil className="w-3 h-3" /></Button>
                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deletePage(page)}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </>
    );
}
