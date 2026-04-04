"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { ThemeSlot } from "@/core/components/theme-slot";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";

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

    const iconMap: Record<string, string> = {
        "account": "👤",
        "payment": "💳",
        "order": "📦",
        "technical": "🔧",
        "general": "ℹ️",
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="text-sm text-gray-500 mb-4">
                    <Link href="/" className="hover:text-blue-600">Home</Link>
                    <span className="mx-2">/</span>
                    <span className="text-gray-700">Help Center</span>
                </div>

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white mb-8">
                    <h1 className="text-3xl font-bold mb-2">How can we help you?</h1>
                    <p className="text-blue-100 mb-6">Search our knowledge base or browse categories below</p>

                    {/* Search */}
                    <div className="flex gap-2 max-w-xl">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            placeholder="Search for articles..."
                            className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
                        />
                        <button
                            onClick={handleSearch}
                            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
                        >
                            Search
                        </button>
                    </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
                        <h2 className="font-bold text-lg mb-4">Search Results ({searchResults.length})</h2>
                        <ul className="space-y-2">
                            {searchResults.map((article) => (
                                <li key={article.id}>
                                    <Link href={`/help/${article.slug}`} className="text-blue-600 hover:underline">
                                        {article.title}
                                    </Link>
                                    <span className="text-gray-400 text-sm ml-2">in {article.category.name}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500">Loading...</p>
                    </div>
                ) : (
                    <ThemeSlot
                        name="SidebarLayout"
                        defaultComponent={<StandardSidebarLayout sidebar={null as any} children={null} />}
                        props={{
                            children: (
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 mb-4">Browse by Category</h2>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {categories.map((category) => (
                                            <Link key={category.id} href={`/help/category/${category.slug}`}>
                                                <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
                                                    <div className="flex items-start gap-4">
                                                        <span className="text-3xl">
                                                            {iconMap[category.icon || ""] || "📚"}
                                                        </span>
                                                        <div>
                                                            <h3 className="font-bold text-gray-900">{category.name}</h3>
                                                            {category.description && (
                                                                <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                                                            )}
                                                            <p className="text-xs text-gray-400 mt-2">
                                                                {category._count.articles} articles
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>

                                    {categories.length === 0 && (
                                        <div className="bg-white rounded-xl p-8 text-center">
                                            <p className="text-gray-500">No help categories available yet</p>
                                        </div>
                                    )}
                                </div>
                            ),
                            sidebar: (
                                <div>
                                    <div className="bg-white rounded-xl border border-gray-100 p-6">
                                        <h3 className="font-bold text-gray-900 mb-4">Popular Articles</h3>
                                        {popularArticles.length > 0 ? (
                                            <ul className="space-y-3">
                                                {popularArticles.map((article) => (
                                                    <li key={article.id}>
                                                        <Link href={`/help/${article.slug}`} className="text-blue-600 hover:underline text-sm">
                                                            {article.title}
                                                        </Link>
                                                        <p className="text-xs text-gray-400">{article.views} views</p>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-gray-500">No articles yet</p>
                                        )}
                                    </div>

                                    <div className="bg-white rounded-xl border border-gray-100 p-6 mt-4">
                                        <h3 className="font-bold text-gray-900 mb-2">Need more help?</h3>
                                        <p className="text-sm text-gray-500 mb-4">Can't find what you're looking for?</p>
                                        <Link href="/support/new" className="text-blue-600 hover:underline text-sm font-medium">
                                            Create a support ticket →
                                        </Link>
                                    </div>
                                </div>
                            )
                        }}
                    />
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
