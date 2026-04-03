"use client";

import { useState, useEffect } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Card, CardContent } from "@/core/components/ui/card";
import { MessageSquare, Eye, ThumbsUp, Pin, Lock, Plus, ChevronRight, Search } from "lucide-react";
import { formatRelativeTime } from "@/core/lib/utils";

interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    _count: { topics: number };
}

interface Topic {
    id: string;
    title: string;
    slug: string;
    isPinned: boolean;
    isLocked: boolean;
    views: number;
    createdAt: string;
    author: { id: string; username: string; avatar: string | null };
    category: { id: string; name: string; slug: string; color: string | null };
    _count: { posts: number; likes: number };
}

export default function ForumPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetch("/api/v1/forum/categories")
            .then((r) => r.json())
            .then((d) => setCategories(d.categories || []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (selectedCategory) params.set("category", selectedCategory);
        if (searchQuery) params.set("search", searchQuery);

        fetch(`/api/v1/forum/topics?${params}`)
            .then((r) => r.json())
            .then((d) => {
                setTopics(d.topics || []);
                setTotalPages(d.pages || 1);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [selectedCategory, page, searchQuery]);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Forum</h1>
                        <p className="text-gray-500 text-sm">Community discussions</p>
                    </div>
                    <Link href="/forum/new">
                        <Button>
                            <Plus className="w-4 h-4 mr-2" /> New Topic
                        </Button>
                    </Link>
                </div>

                {/* Search */}
                <div className="relative max-w-md mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        placeholder="Search topics..."
                        className="pl-10"
                    />
                </div>

                <div className="grid lg:grid-cols-4 gap-6">
                    {/* Sidebar - Categories */}
                    <div className="lg:col-span-1">
                        <Card>
                            <CardContent className="p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">Categories</h3>
                                <div className="space-y-1">
                                    <button
                                        onClick={() => { setSelectedCategory(null); setPage(1); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!selectedCategory ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
                                    >
                                        All Topics
                                    </button>
                                    {categories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${selectedCategory === cat.id ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
                                        >
                                            <span className="flex items-center gap-2">
                                                {cat.icon && <span>{cat.icon}</span>}
                                                {cat.name}
                                            </span>
                                            <span className="text-xs text-gray-400">{cat._count.topics}</span>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Topics List */}
                    <div className="lg:col-span-3 space-y-3">
                        {loading ? (
                            <div className="text-center py-12">
                                <p className="text-gray-500">Loading topics...</p>
                            </div>
                        ) : topics.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 mb-4">No topics yet. Be the first to start a discussion!</p>
                                    <Link href="/forum/new">
                                        <Button>Create Topic</Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                {topics.map((topic) => (
                                    <Link key={topic.id} href={`/forum/topic/${topic.slug}`}>
                                        <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                            <CardContent className="p-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm flex-shrink-0">
                                                        {topic.author.avatar ? (
                                                            <img src={topic.author.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            topic.author.username[0].toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {topic.isPinned && <Pin className="w-3 h-3 text-blue-500" />}
                                                            {topic.isLocked && <Lock className="w-3 h-3 text-gray-400" />}
                                                            <h3 className="font-medium text-gray-900 truncate">{topic.title}</h3>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                                            <span>{topic.author.username}</span>
                                                            <span>·</span>
                                                            <span>{formatRelativeTime(new Date(topic.createdAt))}</span>
                                                            {topic.category && (
                                                                <>
                                                                    <span>·</span>
                                                                    <span
                                                                        className="px-2 py-0.5 rounded text-xs"
                                                                        style={{
                                                                            backgroundColor: (topic.category.color || "#6366f1") + "20",
                                                                            color: topic.category.color || "#6366f1",
                                                                        }}
                                                                    >
                                                                        {topic.category.name}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-gray-400 flex-shrink-0">
                                                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{topic._count.posts}</span>
                                                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{topic.views}</span>
                                                        <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{topic._count.likes}</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex justify-center gap-2 pt-4">
                                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                                            Previous
                                        </Button>
                                        <span className="flex items-center px-3 text-sm text-gray-500">
                                            Page {page} of {totalPages}
                                        </span>
                                        <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                                            Next
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
