"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Pin, PinOff, Lock, Unlock, Trash2, Eye, MessageSquare } from "lucide-react";
import { formatRelativeTime } from "@/core/lib/utils";

interface Topic {
    id: string;
    title: string;
    slug: string;
    isPinned: boolean;
    isLocked: boolean;
    views: number;
    createdAt: string;
    author: { id: string; username: string };
    category: { id: string; name: string; color: string | null };
    _count: { posts: number; likes: number };
}

export default function AdminForumTopicsPage() {
    const t = useTranslations("forum");
    const [topics, setTopics] = useState<Topic[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchTopics = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/forum/topics?page=${page}&limit=20`);
            if (res.ok) {
                const data = await res.json();
                setTopics(data.topics || []);
                setTotal(data.total || 0);
                setTotalPages(data.pages || 1);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTopics();
    }, [page]);  // eslint-disable-line react-hooks/exhaustive-deps

    const togglePin = async (topicId: string, isPinned: boolean) => {
        await fetch(`/api/v1/forum/topics/${topicId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPinned: !isPinned }),
        });
        fetchTopics();
    };

    const toggleLock = async (topicId: string, isLocked: boolean) => {
        await fetch(`/api/v1/forum/topics/${topicId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isLocked: !isLocked }),
        });
        fetchTopics();
    };

    const deleteTopic = async (topicId: string) => {
        if (!confirm("Delete this topic and all its replies?")) return;
        await fetch(`/api/v1/forum/topics/${topicId}`, { method: "DELETE" });
        fetchTopics();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{t("adm_forumTopics")}</h1>
                <p className="text-muted-foreground">{t("adm_topicsTotal", { count: total })}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("adm_allTopics")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {topics.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t("adm_noForumTopics")}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_topic")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_category")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_author")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_stats")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("adm_status")}</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t("adm_actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topics.map((topic) => (
                                        <tr key={topic.id} className="hover:bg-muted/50">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    {topic.isPinned && <Pin className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                                                    {topic.isLocked && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                                                    <div>
                                                        <p className="font-medium line-clamp-1">{topic.title}</p>
                                                        <p className="text-xs text-muted-foreground">{formatRelativeTime(new Date(topic.createdAt))}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span
                                                    className="text-xs px-2 py-1 rounded"
                                                    style={{
                                                        backgroundColor: (topic.category.color || "#6366f1") + "20",
                                                        color: topic.category.color || "#6366f1",
                                                    }}
                                                >
                                                    {topic.category.name}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-muted-foreground">
                                                {topic.author.username}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{topic._count.posts}</span>
                                                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{topic.views}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex gap-1">
                                                    {topic.isPinned && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{t("adm_pinned")}</span>}
                                                    {topic.isLocked && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{t("adm_locked")}</span>}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title={topic.isPinned ? "Unpin" : "Pin"}
                                                        onClick={() => togglePin(topic.id, topic.isPinned)}
                                                    >
                                                        {topic.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title={topic.isLocked ? "Unlock" : "Lock"}
                                                        onClick={() => toggleLock(topic.id, topic.isLocked)}
                                                    >
                                                        {topic.isLocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive"
                                                        onClick={() => deleteTopic(topic.id)}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <p className="text-sm text-muted-foreground">{t("adm_pageOf", { page, totalPages })}</p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>{t("adm_previous")}</Button>
                                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>{t("adm_next")}</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
