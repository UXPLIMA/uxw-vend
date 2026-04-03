"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { RichTextEditor } from "@/core/components/ui/rich-text-editor";
import { Loader2, Trash2 } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
}

export default function EditBlogArticlePage() {
    const params = useParams();
    const router = useRouter();
    const articleId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        title: "",
        excerpt: "",
        content: "",
        coverImage: "",
        status: "DRAFT",
        categoryId: "",
        tags: "",
    });

    useEffect(() => {
        Promise.all([
            fetch(`/api/v1/blog/articles/${articleId}`).then((r) => r.json()),
            fetch("/api/v1/blog/categories").then((r) => r.json()),
        ]).then(([articleData, catData]) => {
            const a = articleData.article || articleData;
            if (a) {
                setFormData({
                    title: a.title || "",
                    excerpt: a.excerpt || "",
                    content: a.content || "",
                    coverImage: a.coverImage || "",
                    status: a.status || "DRAFT",
                    categoryId: a.categoryId || "",
                    tags: a.tags?.map((t: { name: string }) => t.name).join(", ") || "",
                });
            }
            setCategories(Array.isArray(catData) ? catData : catData.categories || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [articleId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/api/v1/blog/articles/${articleId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    categoryId: formData.categoryId || null,
                    tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()) : [],
                    publishedAt: formData.status === "PUBLISHED" ? new Date().toISOString() : undefined,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update article");
            }

            router.push("/admin/blog/articles");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this article?")) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/v1/blog/articles/${articleId}`, { method: "DELETE" });
            if (res.ok) {
                router.push("/admin/blog/articles");
            }
        } catch {
            setError("Failed to delete article");
        } finally {
            setDeleting(false);
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
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Link href="/admin/blog/articles" className="text-sm text-muted-foreground hover:text-primary">
                        ← Back to Articles
                    </Link>
                    <h1 className="text-3xl font-bold mt-2">Edit Article</h1>
                    <p className="text-muted-foreground">{formData.title}</p>
                </div>
                <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleting ? "Deleting..." : "Delete"}
                </Button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/50 text-destructive rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Article Content</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="title">Title *</Label>
                                    <Input
                                        id="title"
                                        value={formData.title}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="excerpt">Excerpt</Label>
                                    <Textarea
                                        id="excerpt"
                                        value={formData.excerpt}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, excerpt: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="content">Content *</Label>
                                    <RichTextEditor
                                        value={formData.content}
                                        onChange={(value: string) => setFormData({ ...formData, content: value })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Publishing</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="status">Status</Label>
                                    <Select
                                        value={formData.status}
                                        onValueChange={(value: string) => setFormData({ ...formData, status: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DRAFT">Draft</SelectItem>
                                            <SelectItem value="PUBLISHED">Published</SelectItem>
                                            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                                            <SelectItem value="ARCHIVED">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="category">Category</Label>
                                    <Select
                                        value={formData.categoryId}
                                        onValueChange={(value: string) => setFormData({ ...formData, categoryId: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">No Category</SelectItem>
                                            {categories.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="pt-4">
                                    <Button type="submit" className="w-full" disabled={saving}>
                                        {saving ? (
                                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                                        ) : (
                                            "Save Changes"
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Media</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div>
                                    <Label htmlFor="coverImage">Cover Image URL</Label>
                                    <Input
                                        id="coverImage"
                                        value={formData.coverImage}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, coverImage: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Tags</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div>
                                    <Label htmlFor="tags">Tags (comma separated)</Label>
                                    <Input
                                        id="tags"
                                        value={formData.tags}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, tags: e.target.value })}
                                        placeholder="news, update, event"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </>
    );
}
