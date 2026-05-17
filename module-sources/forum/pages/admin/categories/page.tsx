"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { RichTextEditor } from "@/core/components/ui/rich-text-editor";
import { Loader2, Plus, X } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    order: number;
    isActive: boolean;
    _count: { topics: number };
}

export default function AdminForumCategoriesPage() {
    const t = useTranslations("forum");
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        description: "",
        icon: "",
        color: "#6366f1",
        order: 0,
    });

    const fetchCategories = async () => {
        try {
            const res = await fetch("/api/v1/forum/categories");
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
            const res = await fetch("/api/v1/forum/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to create category");
                return;
            }

            setShowForm(false);
            setForm({ name: "", description: "", icon: "", color: "#6366f1", order: 0 });
            fetchCategories();
        } catch {
            setError("Something went wrong");
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

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("adm_forumCategories")}</h1>
                    <p className="text-muted-foreground">{t("adm_manageCategories")}</p>
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
                                    <Label>{t("adm_icon")}</Label>
                                    <Input
                                        value={form.icon}
                                        onChange={(e) => setForm({ ...form, icon: e.target.value })}
                                        placeholder="💬"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>{t("adm_description")}</Label>
                                <RichTextEditor
                                    value={form.description}
                                    onChange={(v) => setForm({ ...form, description: v })}
                                />
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>{t("adm_color")}</Label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={form.color}
                                            onChange={(e) => setForm({ ...form, color: e.target.value })}
                                            className="w-10 h-10 rounded cursor-pointer"
                                        />
                                        <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                                    </div>
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

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">{t("adm_noForumCategories")}</p>
                        </CardContent>
                    </Card>
                ) : (
                    categories.map((cat) => (
                        <Card key={cat.id}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {cat.icon && <span>{cat.icon}</span>}
                                    <span style={{ color: cat.color || undefined }}>{cat.name}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-3">
                                    {cat.description || t("adm_noDescription")}
                                </p>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{t('topicsCount', { count: cat._count.topics })}</span>
                                    <span className={cat.isActive ? "text-green-600" : "text-muted-foreground"}>
                                        {cat.isActive ? t("adm_active") : t("adm_inactive")}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </>
    );
}
