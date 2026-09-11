"use client";

import { useState, useEffect, use } from "react";
import { LoadFailed, RichContent } from "@/core/sdk/ui";
import { Link } from "@/core/sdk/navigation";
import { useTranslations } from "next-intl";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { PageFrame } from "@/core/sdk/layout";
import { toast } from "sonner";
import { writeError } from "@/core/sdk";

interface Article {
    id: string;
    title: string;
    slug: string;
    content: string;
    /** null when the site has turned view counts off. */
    views: number | null;
    helpful: number;
    notHelpful: number;
    category: { id: string; name: string; slug: string };
    settings?: { showViewCount: boolean; enableFeedback: boolean };
}

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default function HelpArticlePage({ params }: PageProps) {
    const { slug } = use(params);
    const t = useTranslations("helpCenter");
    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [feedbackGiven, setFeedbackGiven] = useState(false);
    // The other articles in this category. They are what turns an article
    // into somewhere you can read on from, and they give the text beside them
    // a line length somebody can read - the page used to be one column of
    // prose with the right half of the screen empty.
    const [neighbours, setNeighbours] = useState<{ id: string; slug: string; title: string }[]>([]);
    const [neighboursFailed, setNeighboursFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/v1/help/articles/${slug}`)
            .then((res) => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                setArticle(data);
                setLoading(false);
                return data?.category?.id as string | undefined;
            })
            .then((categoryId) => {
                if (cancelled || !categoryId) return;
                return fetch(`/api/v1/help/articles?categoryId=${categoryId}`)
                    .then((res) => { if (!res.ok) throw new Error("load failed"); return res.json(); })
                    .then((rows: { id: string; slug: string; title: string }[]) => {
                        if (cancelled) return;
                        setNeighbours(Array.isArray(rows) ? rows : []);
                        setNeighboursFailed(false);
                    })
                    .catch(() => { if (!cancelled) setNeighboursFailed(true); });
            })
            .catch(() => {
                if (cancelled) return;
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [slug, reloadKey]);

    const submitFeedback = async (helpful: boolean) => {
        if (feedbackGiven) return;

        const res = await fetch(`/api/v1/help/articles/${slug}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ helpful }),
        });
        // Thanking the reader for a vote the server dropped is worse than
        // asking them to try again: the vote is gone either way, and only one
        // of the two says so.
        const failed = await writeError(res, t("feedbackFailed"), t);
        if (failed) { toast.error(failed); return; }
        setFeedbackGiven(true);
    };

    return (
        <PageFrame
            title={article?.title ?? t("title")}
            trail={[
                { label: t("title"), href: "/help" },
                ...(article?.category
                    ? [{ label: article.category.name, href: `/help/category/${article.category.slug}` }]
                    : []),
            ]}
            sidebar={article ? (
                <nav aria-label={t("inThisCategory")} className="bg-card rounded-xl border border-border p-5">
                    <h2 className="font-bold text-foreground mb-4">{t("inThisCategory")}</h2>
                    {neighboursFailed ? (
                        <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
                    ) : (
                        <ul className="space-y-2">
                            {neighbours.map((entry) => (
                                <li key={entry.id}>
                                    <Link
                                        href={`/help/${entry.slug}`}
                                        aria-current={entry.slug === slug ? "page" : undefined}
                                        className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                                            entry.slug === slug
                                                ? "bg-muted font-medium text-foreground"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        }`}
                                    >
                                        {entry.title}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </nav>
            ) : null}
        >
            {loading ? (
                <div className="bg-card rounded-xl p-8 text-center">
                    <p className="text-muted-foreground">{t("loading")}</p>
                </div>
            ) : !article ? (
                <div className="bg-card rounded-xl p-8 text-center">
                    <h2 className="text-xl font-bold text-foreground mb-2">{t("articleNotFound")}</h2>
                    <p className="text-muted-foreground mb-4">{t("articleNotFoundBody")}</p>
                    <Link href="/help" className="text-primary hover:underline">
                        {t("backToHelp")}
                    </Link>
                </div>
            ) : (
                <div>
                    <div className="bg-card rounded-xl border border-border p-8">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6 pb-6 border-b">
                            <span>{t("articleCategory", { name: article.category.name })}</span>
                            {article.views !== null && (
                                <>
                                    <span>•</span>
                                    <span>{t("views", { count: article.views })}</span>
                                </>
                            )}
                        </div>

                        {/* Article Content */}
                        <RichContent
                            className="mb-8"
                            html={article.content}
                        />

                        {/* Feedback */}
                        {article.settings?.enableFeedback !== false && (
                        <div className="border-t pt-6">
                            <p className="font-medium text-foreground mb-3">{t("wasHelpful")}</p>
                            {feedbackGiven ? (
                                <p className="text-success">{t("feedbackThanks")}</p>
                            ) : (
                                <div className="flex gap-3">
                                    {/*
                                        Both of these asked for a hover colour
                                        identical to the resting one, so the
                                        only thing that moved when a pointer
                                        crossed them was nothing at all.
                                    */}
                                    <button
                                        onClick={() => submitFeedback(true)}
                                        className="px-4 py-2 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors inline-flex items-center gap-2"
                                    >
                                        <ThumbsUp className="w-4 h-4" /> {t("helpfulYes")}
                                    </button>
                                    <button
                                        onClick={() => submitFeedback(false)}
                                        className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/70 transition-colors inline-flex items-center gap-2"
                                    >
                                        <ThumbsDown className="w-4 h-4" /> {t("helpfulNo")}
                                    </button>
                                </div>
                            )}
                        </div>
                        )}
                    </div>

                    {/* Related */}
                    <div className="mt-6 text-center">
                        <p className="text-muted-foreground mb-2">{t("stillNeedHelp")}</p>
                        <Link href="/support/new" className="text-primary hover:underline font-medium">
                            {t("createTicket")}
                        </Link>
                    </div>
                </div>
            )}
        </PageFrame>
    );
}
