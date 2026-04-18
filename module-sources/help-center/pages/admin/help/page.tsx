"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { RichTextEditor } from "@/core/components/ui/rich-text-editor";
import { FileUpload } from "@/core/components/ui/file-upload";
import { Loader2, Plus, X } from "lucide-react";

interface HelpCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    isActive: boolean;
    _count?: { articles: number };
}

interface HelpArticle {
    id: string;
    title: string;
    slug: string;
    content: string;
    views: number;
    helpful: number;
    notHelpful: number;
    isActive: boolean;
    category: { id: string; name: string } | null;
}

export default function AdminHelpCenterPage() {
    const t = useTranslations("helpCenter");
    const [categories, setCategories] = useState<HelpCategory[]>([]);
    const [articles, setArticles] = useState<HelpArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"articles" | "categories">("articles");

    // Article form
    const [showArticleForm, setShowArticleForm] = useState(false);
    const [articleForm, setArticleForm] = useState({ title: "", content: "", categoryId: "", isActive: true });
    const [savingArticle, setSavingArticle] = useState(false);

    // Category form
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [categoryForm, setCategoryForm] = useState({ name: "", description: "", icon: "", image: "", isActive: true });
    const [savingCategory, setSavingCategory] = useState(false);
    const [iconMode, setIconMode] = useState<"icon" | "image">("icon");

    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const [catRes, artRes] = await Promise.all([
                fetch("/api/v1/help/categories"),
                fetch("/api/v1/help/articles"),
            ]);
            if (catRes.ok) {
                const catData = await catRes.json();
                setCategories(Array.isArray(catData) ? catData : catData.categories || []);
            }
            if (artRes.ok) {
                const artData = await artRes.json();
                setArticles(Array.isArray(artData) ? artData : artData.articles || []);
            }
        } catch (err) {
            console.error("Failed to fetch help center data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const createArticle = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingArticle(true);
        setError(null);
        try {
            const res = await fetch("/api/v1/help/articles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(articleForm),
            });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to create article");
                return;
            }
            setShowArticleForm(false);
            setArticleForm({ title: "", content: "", categoryId: "", isActive: true });
            fetchData();
        } catch {
            setError("Something went wrong");
        } finally {
            setSavingArticle(false);
        }
    };

    const createCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingCategory(true);
        setError(null);
        try {
            const res = await fetch("/api/v1/help/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(categoryForm),
            });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to create category");
                return;
            }
            setShowCategoryForm(false);
            setCategoryForm({ name: "", description: "", icon: "", image: "", isActive: true });
            fetchData();
        } catch {
            setError("Something went wrong");
        } finally {
            setSavingCategory(false);
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
                    <h1 className="text-3xl font-bold">{t("adm_helpCenter")}</h1>
                    <p className="text-muted-foreground">{t("adm_manageKnowledgeBase")}</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <Button
                    variant={activeTab === "articles" ? "default" : "outline"}
                    onClick={() => setActiveTab("articles")}
                >
                    {t("adm_tabArticles", { count: articles.length })}
                </Button>
                <Button
                    variant={activeTab === "categories" ? "default" : "outline"}
                    onClick={() => setActiveTab("categories")}
                >
                    {t("adm_tabCategories", { count: categories.length })}
                </Button>
            </div>

            {/* Articles Tab */}
            {activeTab === "articles" && (
                <>
                    <div className="flex justify-end mb-4">
                        <Button onClick={() => setShowArticleForm(!showArticleForm)}>
                            {showArticleForm ? <><X className="w-4 h-4 mr-2" /> {t("adm_cancel")}</> : <><Plus className="w-4 h-4 mr-2" /> {t("adm_newArticle")}</>}
                        </Button>
                    </div>

                    {showArticleForm && (
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>{t("adm_newHelpArticle")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={createArticle} className="space-y-4">
                                    <div>
                                        <Label>{`${t("adm_title")} *`}</Label>
                                        <Input
                                            value={articleForm.title}
                                            onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label>{`${t("adm_category")} *`}</Label>
                                        {categories.length === 0 ? (
                                            <p className="text-sm text-destructive mt-1">{t("adm_noCategoriesYet")}</p>
                                        ) : (
                                            <select
                                                value={articleForm.categoryId}
                                                onChange={(e) => setArticleForm({ ...articleForm, categoryId: e.target.value })}
                                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                required
                                            >
                                                <option value="">{t("adm_selectCategory")}</option>
                                                {categories.map((cat) => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div>
                                        <Label>{`${t("adm_content")} *`}</Label>
                                        <RichTextEditor
                                            value={articleForm.content}
                                            onChange={(value: string) => setArticleForm({ ...articleForm, content: value })}
                                        />
                                    </div>
                                    <Button type="submit" disabled={savingArticle}>
                                        {savingArticle ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("adm_creating")}</> : t("adm_createArticle")}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardContent className="p-0">
                            {articles.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">{t("adm_noHelpArticles")}</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_title")}</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_category")}</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_views")}</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_feedback")}</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_status")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {articles.map((article) => (
                                                <tr key={article.id} className="hover:bg-muted/50 border-b last:border-0">
                                                    <td className="py-3 px-4">
                                                        <p className="font-medium">{article.title}</p>
                                                        <p className="text-xs text-muted-foreground">/{article.slug}</p>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-muted-foreground">
                                                        {article.category?.name || "-"}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm">{article.views}</td>
                                                    <td className="py-3 px-4 text-sm">
                                                        <span className="text-green-600">👍 {article.helpful}</span>
                                                        {" / "}
                                                        <span className="text-red-600">👎 {article.notHelpful}</span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`text-xs px-2 py-1 rounded ${
                                                            article.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                                                        }`}>
                                                            {article.isActive ? t("adm_active") : t("adm_inactive")}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Categories Tab */}
            {activeTab === "categories" && (
                <>
                    <div className="flex justify-end mb-4">
                        <Button onClick={() => setShowCategoryForm(!showCategoryForm)}>
                            {showCategoryForm ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> {t("adm_newCategory")}</>}
                        </Button>
                    </div>

                    {showCategoryForm && (
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>{t("adm_newHelpCategory")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={createCategory} className="space-y-4">
                                    <div>
                                        <Label>{`${t("adm_name")} *`}</Label>
                                        <Input
                                            value={categoryForm.name}
                                            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label>{t("adm_description")}</Label>
                                        <Textarea
                                            value={categoryForm.description}
                                            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                                            rows={3}
                                        />
                                    </div>
                                    <div>
                                        <Label>{t("adm_icon")}</Label>
                                        <div className="flex gap-2 mb-2">
                                            <button
                                                type="button"
                                                onClick={() => setIconMode("icon")}
                                                className={`px-3 py-1.5 rounded-md text-xs border ${
                                                    iconMode === "icon"
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-muted border-border text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                Lucide Icon
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIconMode("image")}
                                                className={`px-3 py-1.5 rounded-md text-xs border ${
                                                    iconMode === "image"
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-muted border-border text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                Image Upload
                                            </button>
                                        </div>
                                        {iconMode === "icon" ? (
                                            <Input
                                                value={categoryForm.icon}
                                                onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value, image: "" })}
                                                placeholder="HelpCircle, BookOpen, Lightbulb..."
                                            />
                                        ) : (
                                            <FileUpload
                                                value={categoryForm.image || null}
                                                onChange={(v) => setCategoryForm({ ...categoryForm, image: v || "", icon: "" })}
                                                accept="image/*"
                                            />
                                        )}
                                    </div>
                                    <Button type="submit" disabled={savingCategory}>
                                        {savingCategory ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</> : t("adm_createCategory")}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categories.length === 0 ? (
                            <Card className="col-span-full">
                                <CardContent className="py-8 text-center">
                                    <p className="text-muted-foreground">{t("adm_noHelpCategories")}</p>
                                </CardContent>
                            </Card>
                        ) : (
                            categories.map((cat) => (
                                <Card key={cat.id}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center justify-between">
                                            <span className="flex items-center gap-2">
                                                {cat.icon && <span>{cat.icon}</span>}
                                                {cat.name}
                                            </span>
                                            <span className={`text-xs px-2 py-1 rounded ${
                                                cat.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                                            }`}>
                                                {cat.isActive ? t("adm_active") : t("adm_inactive")}
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            {cat.description || t("adm_noDescription")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {cat._count?.articles || 0} articles
                                        </p>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </>
            )}
        </>
    );
}
