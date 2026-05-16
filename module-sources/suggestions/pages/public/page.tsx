"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Textarea } from "@/core/components/ui/textarea";
import { Loader2, ThumbsUp, Plus, X, MessageSquare } from "lucide-react";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface Suggestion {
    id: string;
    title: string;
    content: string;
    status: string;
    upvotes: number;
    createdAt: string;
    author: { id: string; username: string; avatar: string | null };
    _count: { votes: number };
}

const statusColors: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    under_review: "bg-yellow-100 text-yellow-700",
    accepted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    completed: "bg-purple-100 text-purple-700",
};

const statusKeys: Record<string, string> = {
    open: "open",
    under_review: "underReview",
    accepted: "planned",
    rejected: "declined",
    completed: "completed",
};

export default function SuggestionsPage() {
    const { data: session } = useSession();
    const t = useTranslations("suggestions");
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [visibility, setVisibility] = useState("public");
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState("");
    const [sort, setSort] = useState("newest");
    const [votedIds, setVotedIds] = useState<Set<string>>(new Set());

    const fetchSuggestions = () => {
        const params = new URLSearchParams({ sort });
        if (filter) params.set("status", filter);

        fetch(`/api/v1/suggestions?${params}`)
            .then((r) => r.json())
            .then((d) => { setSuggestions(d.suggestions || []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchSuggestions(); }, [filter, sort]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const res = await fetch("/api/v1/suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, content, visibility }),
        });
        if (res.ok) {
            setTitle(""); setContent(""); setVisibility("public"); setShowForm(false);
            fetchSuggestions();
        }
        setSaving(false);
    };

    const toggleVote = async (id: string) => {
        const res = await fetch(`/api/v1/suggestions/${id}/vote`, { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            setSuggestions((prev) =>
                prev.map((s) => s.id === id ? { ...s, upvotes: data.upvotes } : s)
            );
            setVotedIds((prev) => {
                const next = new Set(prev);
                if (data.voted) { next.add(id); } else { next.delete(id); }
                return next;
            });
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
                        <p className="text-muted-foreground text-sm">{t("description")}</p>
                    </div>
                    {session?.user && (
                        <Button onClick={() => setShowForm(!showForm)}>
                            {showForm ? <><X className="w-4 h-4 mr-2" /> </> : <><Plus className="w-4 h-4 mr-2" /> {t("newSuggestion")}</>}
                        </Button>
                    )}
                </div>

                {showForm && (
                    <Card className="mb-6">
                        <CardContent className="p-5">
                            <form onSubmit={handleSubmit} className="space-y-3">
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("suggestionTitlePlaceholder")} required />
                                <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("suggestionDescriptionPlaceholder")} rows={4} required />
                                <select
                                    value={visibility}
                                    onChange={(e) => setVisibility(e.target.value)}
                                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="public">{t("open")}</option>
                                    <option value="private">{t("other")}</option>
                                </select>
                                <Button type="submit" disabled={saving}>
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    {t("submitSuggestion")}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {["", "open", "under_review", "accepted", "completed", "rejected"].map((s) => (
                        <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>
                            {s === "" ? t("status") : t(statusKeys[s] || "open")}
                        </Button>
                    ))}
                    <div className="ml-auto">
                        <Button variant="outline" size="sm" onClick={() => setSort(sort === "newest" ? "popular" : "newest")}>
                            {t("sortBy")}: {sort === "newest" ? t("newest") : t("mostVoted")}
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : suggestions.length === 0 ? (
                    <Card><CardContent className="py-12 text-center">
                        <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-muted-foreground">{t("noSuggestions")}</p>
                    </CardContent></Card>
                ) : (
                    <div className="space-y-3">
                        {suggestions.map((s) => (
                            <Card key={s.id}>
                                <CardContent className="p-4">
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => session?.user && toggleVote(s.id)}
                                            className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors min-w-[60px] ${
                                                votedIds.has(s.id) ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground hover:bg-muted"
                                            }`}
                                        >
                                            <ThumbsUp className={`w-4 h-4 ${votedIds.has(s.id) ? "fill-blue-600" : ""}`} />
                                            <span className="text-sm font-bold mt-0.5">{s.upvotes}</span>
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-medium text-foreground">{s.title}</h3>
                                                <span className={`text-xs px-2 py-0.5 rounded ${statusColors[s.status] || "bg-muted text-muted-foreground"}`}>
                                                    {t(statusKeys[s.status] || "open")}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-2">{s.content}</p>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                {t("submittedBy")} {s.author.username} · {new Date(s.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
