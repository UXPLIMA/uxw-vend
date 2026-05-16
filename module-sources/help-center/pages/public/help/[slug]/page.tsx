"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import DOMPurify from "dompurify";
import { Navbar, Footer } from "@/core/components/layout";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface Article {
    id: string;
    title: string;
    slug: string;
    content: string;
    views: number;
    helpful: number;
    notHelpful: number;
    category: { id: string; name: string; slug: string };
}

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default function HelpArticlePage({ params }: PageProps) {
    const { slug } = use(params);
    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [feedbackGiven, setFeedbackGiven] = useState(false);

    useEffect(() => {
        fetch(`/api/v1/help/articles/${slug}`)
            .then((res) => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then((data) => {
                setArticle(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [slug]);

    const submitFeedback = async (helpful: boolean) => {
        if (feedbackGiven) return;

        await fetch(`/api/v1/help/articles/${slug}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ helpful }),
        });
        setFeedbackGiven(true);
    };

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <Navbar />
            <ThemeComponentSlot name="Hero" />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="text-sm text-muted-foreground mb-4">
                    <Link href="/" className="hover:text-blue-600">Home</Link>
                    <span className="mx-2">/</span>
                    <Link href="/help" className="hover:text-blue-600">Help Center</Link>
                    {article?.category && (
                        <>
                            <span className="mx-2">/</span>
                            <Link href={`/help/category/${article.category.slug}`} className="hover:text-blue-600">
                                {article.category.name}
                            </Link>
                        </>
                    )}
                    <span className="mx-2">/</span>
                    <span className="text-foreground">{article?.title || "Article"}</span>
                </div>

                {loading ? (
                    <div className="bg-card rounded-xl p-8 text-center">
                        <p className="text-muted-foreground">Loading...</p>
                    </div>
                ) : !article ? (
                    <div className="bg-card rounded-xl p-8 text-center">
                        <h2 className="text-xl font-bold text-foreground mb-2">Article Not Found</h2>
                        <p className="text-muted-foreground mb-4">The article you&apos;re looking for doesn&apos;t exist.</p>
                        <Link href="/help" className="text-blue-600 hover:underline">
                            Back to Help Center
                        </Link>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-card rounded-xl border border-border p-8">
                            <h1 className="text-2xl font-bold text-foreground mb-4">{article.title}</h1>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6 pb-6 border-b">
                                <span>Category: {article.category.name}</span>
                                <span>•</span>
                                <span>{article.views} views</span>
                            </div>

                            {/* Article Content */}
                            <div
                                className="prose prose-blue max-w-none mb-8"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
                            />

                            {/* Feedback */}
                            <div className="border-t pt-6">
                                <p className="font-medium text-foreground mb-3">Was this article helpful?</p>
                                {feedbackGiven ? (
                                    <p className="text-green-600">Thank you for your feedback!</p>
                                ) : (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => submitFeedback(true)}
                                            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                                        >
                                            👍 Yes, helpful
                                        </button>
                                        <button
                                            onClick={() => submitFeedback(false)}
                                            className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted transition-colors"
                                        >
                                            👎 No, not helpful
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Related */}
                        <div className="mt-6 text-center">
                            <p className="text-muted-foreground mb-2">Still need help?</p>
                            <Link href="/support/new" className="text-blue-600 hover:underline font-medium">
                                Create a support ticket
                            </Link>
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
