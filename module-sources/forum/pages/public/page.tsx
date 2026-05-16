"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Link } from "@/core/lib/i18n/navigation";
import { Navbar, Footer } from "@/core/components/layout";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Card, CardContent } from "@/core/components/ui/card";
import { MessageSquare, Eye, ThumbsUp, Pin, Lock, Plus, Search } from "lucide-react";
import { formatRelativeTime } from "@/core/lib/utils";
import { useTranslations } from "next-intl";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

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
    number: number;
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
    const t = useTranslations('forum');

    useEffect(() => {
        fetch("/api/v1/forum/categories")
            .then((r) => r.json())
            .then((d) => setCategories(d.categories || []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
        <div className="min-h-screen flex flex-col bg-muted">
            <Navbar />
            <ThemeComponentSlot name="Hero" />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
                        <p className="text-muted-foreground text-sm">{t('communityDiscussions')}</p>
                    </div>
                    <Link href="/forum/new">
                        <Button>
                            <Plus className="w-4 h-4 mr-2" /> {t('newTopic')}
                        </Button>
                    </Link>
                </div>

                {/* Search */}
                <div className="relative max-w-md mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        placeholder={t('searchTopics')}
                        className="pl-10"
                    />
                </div>

                <div className="grid lg:grid-cols-5 gap-6">
                    {/* Sidebar - Categories */}
                    <div className="lg:col-span-1">
                        <Card>
                            <CardContent className="p-4">
                                <h3 className="font-semibold text-foreground mb-3">{t('categories')}</h3>
                                <div className="space-y-1">
                                    <button
                                        onClick={() => { setSelectedCategory(null); setPage(1); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!selectedCategory ? "bg-blue-50 text-blue-600 font-medium" : "text-muted-foreground hover:bg-muted"}`}
                                    >
                                        {t('allTopics')}
                                    </button>
                                    {categories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${selectedCategory === cat.id ? "bg-blue-50 text-blue-600 font-medium" : "text-muted-foreground hover:bg-muted"}`}
                                        >
                                            <span className="flex items-center gap-2">
                                                {cat.icon && <span>{cat.icon}</span>}
                                                {cat.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{cat._count.topics}</span>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Topics List */}
                    <div className="lg:col-span-4 space-y-3">
                        {loading ? (
                            <div className="text-center py-12">
                                <p className="text-muted-foreground">{t('loadingTopics')}</p>
                            </div>
                        ) : topics.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-muted-foreground mb-4">{t('noTopics')}</p>
                                    <Link href="/forum/new">
                                        <Button>{t('createTopic')}</Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                {topics.map((topic) => (
                                    <Link key={topic.id} href={`/forum/topic/${topic.number}/${topic.slug}`}>
                                        <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                            <CardContent className="p-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm flex-shrink-0">
                                                        {topic.author.avatar ? (
                                                            <Image src={topic.author.avatar} alt="" width={40} height={40} className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            topic.author.username[0].toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {topic.isPinned && <Pin className="w-3 h-3 text-blue-500" />}
                                                            {topic.isLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                                                            <h3 className="font-medium text-foreground truncate">{topic.title}</h3>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
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
                                            {t('previous')}
                                        </Button>
                                        <span className="flex items-center px-3 text-sm text-muted-foreground">
                                            {t('pageOf', { page, total: totalPages })}
                                        </span>
                                        <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                                            {t('next')}
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
