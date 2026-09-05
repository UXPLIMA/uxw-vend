"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect, use } from "react";
import { useRouter } from "@/core/sdk/navigation";
import { Link } from "@/core/sdk/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, RichTextEditor, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useConfirm } from "@/core/sdk/ui";
import { Loader2, Trash2 } from "lucide-react";
import { writeError } from "@/core/sdk";

interface Category {
    id: string;
    name: string;
    slug: string;
}

interface PageProps {
    params: Promise<{ id: string; locale: string }>;
}

export default function EditBlogArticlePage(props: PageProps) {
    const t = useTranslations("blog");
    const commonT = useTranslations("common");
    const { confirm } = useConfirm();
    const params = use(props.params);
    const router = useRouter();
    const articleId = params.id;

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
        let cancelled = false;
        Promise.all([
            fetch(`/api/v1/blog/articles/${articleId}`).then((r) => r.json()),
            fetch("/api/v1/blog/categories").then((r) => r.json()),
        ]).then(([articleData, catData]) => {
            if (cancelled) return;
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
        }).catch(() => {
            if (cancelled) return;
            setLoading(false);
        });
        return () => { cancelled = true; };
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

            const failed = await writeError(res, t("adm_updateArticleFailed"), t);
            if (failed) {
                throw new Error(failed);
            }

            router.push("/admin/blog/articles");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : commonT("somethingWentWrong"));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const ok = await confirm({
            title: t("adm_deleteArticle"),
            message: t("adm_deleteArticleConfirm"),
            variant: "danger",
            confirmText: commonT("delete"),
        });
        if (!ok) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/v1/blog/articles/${articleId}`, { method: "DELETE" });
            // The answer used to be dropped: a refused delete left the page
            // where it was with nothing said, which reads as "nothing
            // happened" rather than "that did not work".
            const failed = await writeError(res, t("adm_deleteFailed"), t);
            if (failed) { setError(failed); return; }
            router.push("/admin/blog/articles");
        } catch {
            setError(t("adm_deleteFailed"));
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
                    <h1 className="text-3xl font-bold mt-2">{t("adm_editArticle")}</h1>
                    <p className="text-muted-foreground">{formData.title}</p>
                </div>
                <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleting ? t("adm_deleting") : t("adm_delete")}
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
                                <CardTitle>{t("adm_articleContent")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="title">{`${t("adm_titleField")} *`}</Label>
                                    <Input
                                        id="title"
                                        value={formData.title}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="excerpt">{t("adm_excerpt")}</Label>
                                    <Textarea
                                        id="excerpt"
                                        value={formData.excerpt}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, excerpt: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <Label id="content-label">{`${t("adm_content")} *`}</Label>
                                    <RichTextEditor
                                        labelledBy="content-label"
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
                                <CardTitle>{t("adm_publishing")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="status">{t("adm_status")}</Label>
                                    <Select
                                        value={formData.status}
                                        onValueChange={(value: string) => setFormData({ ...formData, status: value })}
                                    >
                                        <SelectTrigger id="status">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DRAFT">{t("adm_draft")}</SelectItem>
                                            <SelectItem value="PUBLISHED">{t("adm_published")}</SelectItem>
                                            <SelectItem value="SCHEDULED">{t("adm_scheduled")}</SelectItem>
                                            <SelectItem value="ARCHIVED">{t("adm_archived")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="category">{t("adm_category")}</Label>
                                    <Select
                                        value={formData.categoryId}
                                        onValueChange={(value: string) => setFormData({ ...formData, categoryId: value })}
                                    >
                                        <SelectTrigger id="category">
                                            <SelectValue placeholder={t("adm_selectCategory")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">{t("adm_noCategory")}</SelectItem>
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
                                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("adm_saving")}</>
                                        ) : (
                                            t("adm_saveChanges")
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t("adm_media")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div>
                                    <Label htmlFor="coverImage">{t("adm_coverImage")}</Label>
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
                                <CardTitle>{t("adm_tags")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div>
                                    <Label htmlFor="tags">{t("adm_tagsHelp")}</Label>
                                    <Input
                                        id="tags"
                                        value={formData.tags}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, tags: e.target.value })}
                                        placeholder={t("adm_tagsPlaceholder")}
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
