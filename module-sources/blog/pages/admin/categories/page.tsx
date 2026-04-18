"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Plus, X, Trash2, Pencil } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    _count: { articles: number };
}

export default function AdminBlogCategoriesPage() {
    const t = useTranslations("blog");
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({ name: "", description: "" });

    const fetchCategories = async () => {
        try {
            const res = await fetch("/api/v1/blog/categories");
            if (res.ok) {
                const data = await res.json();
                setCategories(Array.isArray(data) ? data : data.categories || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const resetForm = () => {
        setForm({ name: "", description: "" });
        setShowForm(false);
        setEditingId(null);
        setError(null);
    };

    const startEdit = (cat: Category) => {
        setEditingId(cat.id);
        setForm({ name: cat.name, description: cat.description || "" });
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const url = editingId ? `/api/v1/blog/categories/${editingId}` : "/api/v1/blog/categories";
            const method = editingId ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to save category");
                return;
            }

            resetForm();
            fetchCategories();
        } catch {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const deleteCategory = async (id: string) => {
        if (!confirm("Delete this category? Articles will be unlinked.")) return;
        try {
            const res = await fetch(`/api/v1/blog/categories/${id}`, { method: "DELETE" });
            if (res.ok) fetchCategories();
            else {
                const data = await res.json();
                alert(data.error || "Failed to delete");
            }
        } catch {
            alert("Failed to delete category");
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
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("adm_blogCategories")}</h1>
                    <p className="text-muted-foreground">{t("adm_organizeBlog")}</p>
                </div>
                <Button onClick={() => { resetForm(); setShowForm(true); }}>
                    {showForm && !editingId ? <><X className="w-4 h-4 mr-2" /> {t("adm_cancel")}</> : <><Plus className="w-4 h-4 mr-2" /> {t("adm_newCategory")}</>}
                </Button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
            )}

            {showForm && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{editingId ? t("adm_editCategory") : t("adm_newCategory")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>{`${t("adm_name")} *`}</Label>
                                    <Input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>{t("adm_description")}</Label>
                                    <Input
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder={t("adm_briefDescription")}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" disabled={saving}>
                                    {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("adm_saving")}</> :
                                     editingId ? t("adm_saveChanges") : t("adm_createCategory")}
                                </Button>
                                {editingId && (
                                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="py-12 text-center">
                            <p className="text-muted-foreground">{t("adm_noCategoriesYet")}</p>
                        </CardContent>
                    </Card>
                ) : (
                    categories.map((category) => (
                        <Card key={category.id}>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>{category.name}</span>
                                    <span className="text-sm font-normal text-muted-foreground">
                                        {category._count.articles} articles
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {category.description || t("adm_noDescription")}
                                </p>
                                <p className="text-xs text-muted-foreground mb-3">/{category.slug}</p>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => startEdit(category)}>
                                        <Pencil className="w-3 h-3 mr-1" /> {t("adm_edit")}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive"
                                        onClick={() => deleteCategory(category.id)}
                                    >
                                        <Trash2 className="w-3 h-3 mr-1" /> {t("adm_delete")}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </>
    );
}
