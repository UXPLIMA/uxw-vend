"use client";

import { useState, useEffect, use } from "react";
import { Link } from "@/core/sdk/navigation";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageFrame } from "@/core/sdk/layout";
import { LoadFailed, Pagination, usePagedRows } from "@/core/sdk/ui";

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
    const paged = usePagedRows(articles, 12);

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
                        <>
                            {/* One card per article rather than a stack of
                                links: a row that only carries a title reads as
                                a list of the same thing, and a category with
                                thirty of them had no way to stop scrolling. */}
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {paged.rows.map((article) => (
                                    <Link
                                        key={article.id}
                                        href={`/help/${article.slug}`}
                                        className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted"
                                    >
                                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                            {article.title}
                                        </span>
                                        <span className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                                            <Eye className="w-3 h-3" aria-hidden="true" />
                                            {t("views", { count: article.views })}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                            {paged.pages > 1 && (
                                <Pagination
                                    className="mt-6"
                                    page={paged.page}
                                    pages={paged.pages}
                                    total={paged.total}
                                    onPageChange={paged.setPage}
                                />
                            )}
                        </>
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
