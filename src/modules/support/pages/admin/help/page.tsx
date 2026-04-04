"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Loader2, Plus, Trash2, Edit2, X, Check } from "lucide-react";

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
    const [categoryForm, setCategoryForm] = useState({ name: "", description: "", icon: "", isActive: true });
    const [savingCategory, setSavingCategory] = useState(false);

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
            setCategoryForm({ name: "", description: "", icon: "", isActive: true });
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
                    <h1 className="text-3xl font-bold">Help Center</h1>
                    <p className="text-muted-foreground">Manage knowledge base articles and categories</p>
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
                    Articles ({articles.length})
                </Button>
                <Button
                    variant={activeTab === "categories" ? "default" : "outline"}
                    onClick={() => setActiveTab("categories")}
                >
                    Categories ({categories.length})
                </Button>
            </div>

            {/* Articles Tab */}
            {activeTab === "articles" && (
                <>
                    <div className="flex justify-end mb-4">
                        <Button onClick={() => setShowArticleForm(!showArticleForm)}>
                            {showArticleForm ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> New Article</>}
                        </Button>
                    </div>

                    {showArticleForm && (
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>New Help Article</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={createArticle} className="space-y-4">
                                    <div>
                                        <Label>Title *</Label>
                                        <Input
                                            value={articleForm.title}
                                            onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label>Category</Label>
                                        <select
                                            value={articleForm.categoryId}
                                            onChange={(e) => setArticleForm({ ...articleForm, categoryId: e.target.value })}
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            <option value="">No category</option>
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <Label>Content *</Label>
                                        <Textarea
                                            value={articleForm.content}
                                            onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                                            rows={8}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" disabled={savingArticle}>
                                        {savingArticle ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</> : "Create Article"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardContent className="p-0">
                            {articles.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No help articles yet</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Title</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Views</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Feedback</th>
                                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
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
                                                            article.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                                        }`}>
                                                            {article.isActive ? "Active" : "Inactive"}
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
                            {showCategoryForm ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> New Category</>}
                        </Button>
                    </div>

                    {showCategoryForm && (
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>New Help Category</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={createCategory} className="space-y-4">
                                    <div>
                                        <Label>Name *</Label>
                                        <Input
                                            value={categoryForm.name}
                                            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label>Description</Label>
                                        <Textarea
                                            value={categoryForm.description}
                                            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                                            rows={3}
                                        />
                                    </div>
                                    <div>
                                        <Label>Icon (emoji or icon name)</Label>
                                        <Input
                                            value={categoryForm.icon}
                                            onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                                            placeholder="📚"
                                        />
                                    </div>
                                    <Button type="submit" disabled={savingCategory}>
                                        {savingCategory ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</> : "Create Category"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categories.length === 0 ? (
                            <Card className="col-span-full">
                                <CardContent className="py-8 text-center">
                                    <p className="text-muted-foreground">No help categories yet</p>
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
                                                cat.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                            }`}>
                                                {cat.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            {cat.description || "No description"}
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
