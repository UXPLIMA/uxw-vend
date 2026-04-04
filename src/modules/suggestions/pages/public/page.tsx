"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Textarea } from "@/core/components/ui/textarea";
import { Loader2, ThumbsUp, Plus, X, MessageSquare } from "lucide-react";

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

export default function SuggestionsPage() {
    const { data: session } = useSession();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
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

    useEffect(() => { fetchSuggestions(); }, [filter, sort]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const res = await fetch("/api/v1/suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, content }),
        });
        if (res.ok) {
            setTitle(""); setContent(""); setShowForm(false);
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
                data.voted ? next.add(id) : next.delete(id);
                return next;
            });
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Suggestions</h1>
                        <p className="text-gray-500 text-sm">Share your ideas and vote on others</p>
                    </div>
                    {session?.user && (
                        <Button onClick={() => setShowForm(!showForm)}>
                            {showForm ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> New Idea</>}
                        </Button>
                    )}
                </div>

                {showForm && (
                    <Card className="mb-6">
                        <CardContent className="p-5">
                            <form onSubmit={handleSubmit} className="space-y-3">
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Your suggestion title" required />
                                <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Describe your idea..." rows={4} required />
                                <Button type="submit" disabled={saving}>
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Submit Suggestion
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {["", "open", "under_review", "accepted", "completed", "rejected"].map((s) => (
                        <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>
                            {s === "" ? "All" : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </Button>
                    ))}
                    <div className="ml-auto">
                        <Button variant="outline" size="sm" onClick={() => setSort(sort === "newest" ? "popular" : "newest")}>
                            Sort: {sort === "newest" ? "Newest" : "Popular"}
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                ) : suggestions.length === 0 ? (
                    <Card><CardContent className="py-12 text-center">
                        <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No suggestions yet. Be the first!</p>
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
                                                votedIds.has(s.id) ? "bg-blue-100 text-blue-600" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                                            }`}
                                        >
                                            <ThumbsUp className={`w-4 h-4 ${votedIds.has(s.id) ? "fill-blue-600" : ""}`} />
                                            <span className="text-sm font-bold mt-0.5">{s.upvotes}</span>
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-medium text-gray-900">{s.title}</h3>
                                                <span className={`text-xs px-2 py-0.5 rounded ${statusColors[s.status] || "bg-gray-100 text-gray-600"}`}>
                                                    {s.status.replace("_", " ")}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 line-clamp-2">{s.content}</p>
                                            <p className="text-xs text-gray-400 mt-2">
                                                by {s.author.username} · {new Date(s.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
