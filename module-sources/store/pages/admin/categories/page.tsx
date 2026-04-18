"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { RichTextEditor } from "@/core/components/ui/rich-text-editor";
import { FileUpload } from "@/core/components/ui/file-upload";
import { Loader2, Plus, X, Trash2 } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image: string | null;
    parentId: string | null;
    isActive: boolean;
    order: number;
    children?: Category[];
    _count?: { products: number };
}

export default function AdminStoreCategoriesPage() {
    const t = useTranslations("store");
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        description: "",
        image: "",
        parentId: "",
        order: 0,
        isActive: true,
    });

    const fetchCategories = async () => {
        try {
            const res = await fetch("/api/v1/store/categories");
            if (res.ok) {
                const data = await res.json();
                setCategories(data.categories || []);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const res = await fetch("/api/v1/store/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    parentId: form.parentId || null,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to create category");
                return;
            }

            setShowForm(false);
            setForm({ name: "", description: "", image: "", parentId: "", order: 0, isActive: true });
            fetchCategories();
        } catch {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const deleteCategory = async (id: string) => {
        if (!confirm("Delete this category? Products will be unlinked.")) return;
        try {
            const res = await fetch(`/api/v1/store/categories/${id}`, { method: "DELETE" });
            if (res.ok) fetchCategories();
            else {
                const data = await res.json();
                alert(data.error || "Failed to delete");
            }
        } catch {
            alert("Failed to delete category");
        }
    };

    // Flatten categories for parent select (only root-level)
    const rootCategories = categories.filter((c) => !c.parentId);

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
                    <h1 className="text-3xl font-bold">{t("adm_storeCategories")}</h1>
                    <p className="text-muted-foreground">{t("adm_organizeProducts")}</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    {showForm ? <><X className="w-4 h-4 mr-2" /> {t("adm_cancel")}</> : <><Plus className="w-4 h-4 mr-2" /> {t("adm_newCategory")}</>}
                </Button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
            )}

            {showForm && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{t("adm_newCategory")}</CardTitle>
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
                                    <Label>{t("adm_parentCategory")}</Label>
                                    <select
                                        value={form.parentId}
                                        onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="">{t("adm_rootCategory")}</option>
                                        {rootCategories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <Label>{t("adm_description")}</Label>
                                <RichTextEditor
                                    value={form.description}
                                    onChange={(value: string) => setForm({ ...form, description: value })}
                                />
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>{t("adm_imageUrl")}</Label>
                                    <FileUpload
                                        value={form.image || null}
                                        onChange={(v) => setForm({ ...form, image: v || "" })}
                                        accept="image/*"
                                    />
                                </div>
                                <div>
                                    <Label>{t("adm_order")}</Label>
                                    <Input
                                        type="number"
                                        value={form.order}
                                        onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                            <Button type="submit" disabled={saving}>
                                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("adm_creating")}</> : t("adm_createCategory")}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Category Tree */}
            <div className="space-y-4">
                {categories.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">{t("adm_noStoreCategories")}</p>
                        </CardContent>
                    </Card>
                ) : (
                    rootCategories.map((cat) => (
                        <Card key={cat.id}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {cat.image ? (
                                            <Image src={cat.image} alt={cat.name} width={40} height={40} className="w-10 h-10 rounded-lg object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-lg">📁</div>
                                        )}
                                        <div>
                                            <p className="font-medium">{cat.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {cat._count?.products || 0} products · /{cat.slug}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-1 rounded ${cat.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                                            {cat.isActive ? t("adm_active") : t("adm_inactive")}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive"
                                            onClick={() => deleteCategory(cat.id)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Sub-categories */}
                                {cat.children && cat.children.length > 0 && (
                                    <div className="ml-12 mt-3 space-y-2">
                                        {cat.children.map((sub) => (
                                            <div key={sub.id} className="flex items-center justify-between py-2 border-t border-border">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">└</span>
                                                    <p className="text-sm font-medium">{sub.name}</p>
                                                    <p className="text-xs text-muted-foreground">/{sub.slug}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive"
                                                    onClick={() => deleteCategory(sub.id)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </>
    );
}
