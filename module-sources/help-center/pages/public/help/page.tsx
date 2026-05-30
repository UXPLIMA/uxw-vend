"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar, Footer } from "@/core/components/layout";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";
import { useTranslations } from "next-intl";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";
import { User, CreditCard, Package, Wrench, Info, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    _count: { articles: number };
}

interface Article {
    id: string;
    title: string;
    slug: string;
    views: number;
    category: { name: string; slug: string };
}

export default function HelpCenterPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [popularArticles, setPopularArticles] = useState<Article[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const t = useTranslations('helpCenter');
    const commonT = useTranslations('common');

    useEffect(() => {
        Promise.all([
            fetch("/api/v1/help/categories").then(r => r.json()),
            fetch("/api/v1/help/articles?limit=5").then(r => r.json()),
        ]).then(([cats, articles]) => {
            setCategories(cats || []);
            setPopularArticles(articles || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        const res = await fetch(`/api/v1/help/articles?search=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data || []);
    };

    const iconMap: Record<string, LucideIcon> = {
        account: User,
        payment: CreditCard,
        order: Package,
        technical: Wrench,
        general: Info,
    };

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="text-sm text-muted-foreground mb-4">
                    <Link href="/" className="hover:text-blue-600">{commonT('home')}</Link>
                    <span className="mx-2">/</span>
                    <span className="text-foreground">{t('title')}</span>
                </div>

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white mb-8">
                    <h1 className="text-3xl font-bold mb-2">{t('heading')}</h1>
                    <p className="text-blue-100 mb-6">{t('subtitle')}</p>

                    {/* Search */}
                    <div className="flex gap-2 max-w-xl">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            placeholder={t('searchPlaceholder')}
                            className="flex-1 min-w-0 px-4 py-3 rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-white"
                        />
                        <button
                            onClick={handleSearch}
                            className="px-6 py-3 bg-card/20 hover:bg-card/30 rounded-lg font-medium transition-colors"
                        >
                            {t('search')}
                        </button>
                    </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="bg-card rounded-xl border border-border p-6 mb-8">
                        <h2 className="font-bold text-lg mb-4">{t('searchResults')} ({searchResults.length})</h2>
                        <ul className="space-y-2">
                            {searchResults.map((article) => (
                                <li key={article.id}>
                                    <Link href={`/help/${article.slug}`} className="text-blue-600 hover:underline">
                                        {article.title}
                                    </Link>
                                    <span className="text-muted-foreground text-sm ml-2">{t('inCategory', { category: article.category.name })}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">{t('loading')}</p>
                    </div>
                ) : (
                    <StandardSidebarLayout sidebar={(
                                <div>
                                    <div className="bg-card rounded-xl border border-border p-6">
                                        <h3 className="font-bold text-foreground mb-4">{t('popularArticles')}</h3>
                                        {popularArticles.length > 0 ? (
                                            <ul className="space-y-3">
                                                {popularArticles.map((article) => (
                                                    <li key={article.id}>
                                                        <Link href={`/help/${article.slug}`} className="text-blue-600 hover:underline text-sm">
                                                            {article.title}
                                                        </Link>
                                                        <p className="text-xs text-muted-foreground">{t('views', { count: article.views })}</p>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">{t('noArticlesYet')}</p>
                                        )}
                                    </div>

                                    <div className="bg-card rounded-xl border border-border p-6 mt-4">
                                        <h3 className="font-bold text-foreground mb-2">{t('needHelp')}</h3>
                                        <p className="text-sm text-muted-foreground mb-4">{t('cantFind')}</p>
                                        <Link href="/support/new" className="text-blue-600 hover:underline text-sm font-medium">
                                            {t('createTicket')} →
                                        </Link>
                                    </div>
                                </div>
                            )}>
                        {(
                                <div>
                                    <h2 className="text-xl font-bold text-foreground mb-4">{t('browseCategories')}</h2>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {categories.map((category) => (
                                            <Link key={category.id} href={`/help/category/${category.slug}`}>
                                                <div className="bg-card rounded-xl border border-border p-6 hover:shadow-md transition-shadow">
                                                    <div className="flex items-start gap-4">
                                                        {(() => {
                                                            const Icon = iconMap[category.icon || ""] || BookOpen;
                                                            return <Icon className="w-8 h-8 text-blue-600 flex-shrink-0 mt-0.5" />;
                                                        })()}
                                                        <div>
                                                            <h3 className="font-bold text-foreground">{category.name}</h3>
                                                            {category.description && (
                                                                <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                                                            )}
                                                            <p className="text-xs text-muted-foreground mt-2">
                                                                {t('articles', { count: category._count.articles })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>

                                    {categories.length === 0 && (
                                        <div className="bg-card rounded-xl p-8 text-center">
                                            <p className="text-muted-foreground">{t('noCategories')}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                    </StandardSidebarLayout>
                )}
            </main>

            <Footer />
        </div>
    );
}
