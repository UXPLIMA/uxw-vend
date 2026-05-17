"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/core/lib/i18n/navigation";
import { Link } from "@/core/lib/i18n/navigation";
import { Navbar, Footer } from "@/core/components/layout";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Textarea } from "@/core/components/ui/textarea";
import { Label } from "@/core/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { ArrowLeft, Loader2, FolderPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface Category {
    id: string;
    name: string;
    slug: string;
}

export default function NewTopicPage() {
    const router = useRouter();
    const t = useTranslations('forum');
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoriesLoaded, setCategoriesLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        title: "",
        content: "",
        categoryId: "",
    });

    useEffect(() => {
        fetch("/api/v1/forum/categories")
            .then((r) => r.json())
            .then((d) => setCategories(d.categories || []))
            .catch(() => undefined)
            .finally(() => setCategoriesLoaded(true));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const res = await fetch("/api/v1/forum/topics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to create topic");
                return;
            }

            const data = await res.json();
            router.push(`/forum/topic/${data.topic.number}/${data.topic.slug}`);
        } catch {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <Link href="/forum" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-blue-600 mb-4">
                    <ArrowLeft className="w-4 h-4" /> {t('backToForum')}
                </Link>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('newTopic')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {categoriesLoaded && categories.length === 0 ? (
                            <div className="text-center py-10">
                                <FolderPlus className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                                <p className="font-medium text-foreground">{t('noCategoriesTitle')}</p>
                                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{t('noCategoriesHelp')}</p>
                            </div>
                        ) : (
                            <>
                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <Label>{t('categoryLabel')}</Label>
                                        <select
                                            value={form.categoryId}
                                            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            required
                                        >
                                            <option value="">{t('selectCategory')}</option>
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <Label>{t('titleLabel')}</Label>
                                        <Input
                                            value={form.title}
                                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                                            placeholder={t('topicTitle')}
                                            required
                                            minLength={3}
                                        />
                                    </div>

                                    <div>
                                        <Label>{t('contentLabel')}</Label>
                                        <Textarea
                                            value={form.content}
                                            onChange={(e) => setForm({ ...form, content: e.target.value })}
                                            placeholder={t('topicContent')}
                                            rows={8}
                                            required
                                            minLength={10}
                                        />
                                    </div>

                                    <Button type="submit" disabled={saving}>
                                        {saving ? (
                                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('creating')}</>
                                        ) : (
                                            t('createTopic')
                                        )}
                                    </Button>
                                </form>
                            </>
                        )}
                    </CardContent>
                </Card>
            </main>

            <Footer />
        </div>
    );
}
