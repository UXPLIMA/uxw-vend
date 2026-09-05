"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import DOMPurify from "dompurify";
import { useTranslations } from "next-intl";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Footer, Navbar } from "@/core/sdk/layout";
import { ThemeComponentSlot } from "@/core/sdk/theme";
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
    const commonT = useTranslations("common");
    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [feedbackGiven, setFeedbackGiven] = useState(false);

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
            })
            .catch(() => {
                if (cancelled) return;
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [slug]);

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
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="text-sm text-muted-foreground mb-4">
                    <Link href="/" className="hover:text-blue-600">{commonT("home")}</Link>
                    <span className="mx-2">/</span>
                    <Link href="/help" className="hover:text-blue-600">{t("title")}</Link>
                    {article?.category && (
                        <>
                            <span className="mx-2">/</span>
                            <Link href={`/help/category/${article.category.slug}`} className="hover:text-blue-600">
                                {article.category.name}
                            </Link>
                        </>
                    )}
                    <span className="mx-2">/</span>
                    <span className="text-foreground">{article?.title || ""}</span>
                </div>

                {loading ? (
                    <div className="bg-card rounded-xl p-8 text-center">
                        <p className="text-muted-foreground">{t("loading")}</p>
                    </div>
                ) : !article ? (
                    <div className="bg-card rounded-xl p-8 text-center">
                        <h1 className="text-xl font-bold text-foreground mb-2">{t("articleNotFound")}</h1>
                        <p className="text-muted-foreground mb-4">{t("articleNotFoundBody")}</p>
                        <Link href="/help" className="text-blue-600 hover:underline">
                            {t("backToHelp")}
                        </Link>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-card rounded-xl border border-border p-8">
                            <h1 className="text-2xl font-bold text-foreground mb-4">{article.title}</h1>

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
                            <div
                                className="prose prose-blue max-w-none mb-8"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
                            />

                            {/* Feedback */}
                            {article.settings?.enableFeedback !== false && (
                            <div className="border-t pt-6">
                                <p className="font-medium text-foreground mb-3">{t("wasHelpful")}</p>
                                {feedbackGiven ? (
                                    <p className="text-green-600">{t("feedbackThanks")}</p>
                                ) : (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => submitFeedback(true)}
                                            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors inline-flex items-center gap-2"
                                        >
                                            <ThumbsUp className="w-4 h-4" /> {t("helpfulYes")}
                                        </button>
                                        <button
                                            onClick={() => submitFeedback(false)}
                                            className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted transition-colors inline-flex items-center gap-2"
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
                            <Link href="/support/new" className="text-blue-600 hover:underline font-medium">
                                {t("createTicket")}
                            </Link>
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
