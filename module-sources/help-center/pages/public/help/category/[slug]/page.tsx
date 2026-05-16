"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Navbar, Footer } from "@/core/components/layout";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

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
    const [category, setCategory] = useState<Category | null>(null);
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get all categories to find the current one
        fetch("/api/v1/help/categories")
            .then((res) => res.json())
            .then((categories) => {
                const cat = categories.find((c: Category) => c.slug === slug);
                if (cat) {
                    setCategory(cat);
                    // Get articles for this category
                    return fetch(`/api/v1/help/articles?categoryId=${cat.id}`);
                }
                throw new Error("Category not found");
            })
            .then((res) => res.json())
            .then((data) => {
                setArticles(data || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [slug]);

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
                    <span className="mx-2">/</span>
                    <span className="text-foreground">{category?.name || "Category"}</span>
                </div>

                {loading ? (
                    <div className="bg-card rounded-xl p-8 text-center">
                        <p className="text-muted-foreground">Loading...</p>
                    </div>
                ) : !category ? (
                    <div className="bg-card rounded-xl p-8 text-center">
                        <h2 className="text-xl font-bold text-foreground mb-2">Category Not Found</h2>
                        <p className="text-muted-foreground mb-4">The category you&apos;re looking for doesn&apos;t exist.</p>
                        <Link href="/help" className="text-blue-600 hover:underline">
                            Back to Help Center
                        </Link>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto">
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-foreground">{category.name}</h1>
                            {category.description && (
                                <p className="text-muted-foreground mt-1">{category.description}</p>
                            )}
                        </div>

                        {articles.length > 0 ? (
                            <div className="bg-card rounded-xl border border-border divide-y">
                                {articles.map((article) => (
                                    <Link
                                        key={article.id}
                                        href={`/help/${article.slug}`}
                                        className="block p-4 hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-blue-600 hover:underline font-medium">
                                                {article.title}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{article.views} views</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-card rounded-xl p-8 text-center">
                                <p className="text-muted-foreground">No articles in this category yet</p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
