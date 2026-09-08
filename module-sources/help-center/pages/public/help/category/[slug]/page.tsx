"use client";

import { useState, useEffect, use } from "react";
import { Link } from "@/core/sdk/navigation";
import { useTranslations } from "next-intl";
import { PageFrame } from "@/core/sdk/layout";
import { LoadFailed } from "@/core/sdk/ui";

interface Article {
    id: string;
    title: string;
    slug: string;
    views: number;
}

interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
}

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default function HelpCategoryPage({ params }: PageProps) {
    const { slug } = use(params);
    const t = useTranslations("helpCenter");
    const [category, setCategory] = useState<Category | null>(null);
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        // A category that does not exist gets its own message below. This
        // tracks the other case: the request never arrived, which used to
        // render "no articles in this category" for a server that was down.
        let known = true;
        fetch("/api/v1/help/categories")
            .then((res) => { if (!res.ok) throw new Error("load failed"); return res.json(); })
            .then((categories) => {
                if (cancelled) return null;
                const cat = categories.find((c: Category) => c.slug === slug);
                if (!cat) { known = false; throw new Error("Category not found"); }
                setCategory(cat);
                return fetch(`/api/v1/help/articles?categoryId=${cat.id}`);
            })
            .then((res) => {
                if (!res) return null;
                if (!res.ok) throw new Error("load failed");
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                setArticles(data || []);
                setFailed(false);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setFailed(known);
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [slug, reloadKey]);

    return (
        <PageFrame
            title={category?.name ?? t("title")}
            description={category?.description || undefined}
            trail={[{ label: t("title"), href: "/help" }]}
        >
            {loading ? (
                <div className="bg-card rounded-xl p-8 text-center">
                    <p className="text-muted-foreground">{t("loading")}</p>
                </div>
            ) : !category ? (
                <div className="bg-card rounded-xl p-8 text-center">
                    <h2 className="text-xl font-bold text-foreground mb-2">{t("categoryNotFound")}</h2>
                    <p className="text-muted-foreground mb-4">{t("categoryNotFoundBody")}</p>
                    <Link href="/help" className="text-primary hover:underline">
                        {t("backToHelp")}
                    </Link>
                </div>
            ) : (
                <div>
                    {failed ? (
                        <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
                    ) : articles.length > 0 ? (
                        <div className="bg-card rounded-xl border border-border divide-y">
                            {articles.map((article) => (
                                <Link
                                    key={article.id}
                                    href={`/help/${article.slug}`}
                                    className="block p-4 hover:bg-muted transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-primary hover:underline font-medium">
                                            {article.title}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{t("views", { count: article.views })}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-card rounded-xl p-8 text-center">
                            <p className="text-muted-foreground">{t("noArticlesInCategory")}</p>
                        </div>
                    )}
                </div>
            )}
        </PageFrame>
    );
}
