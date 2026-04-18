"use client";

import { useState, useEffect } from "react";
import { Button } from "@/core/components/ui/button";
import { Loader2, MessageCircle, Send } from "lucide-react";

interface Comment {
    id: string;
    content: string;
    createdAt: string;
    author: { username: string; image?: string | null };
}

export function CommentSection({ postId, articleId }: { postId?: string; articleId?: string }) {
    const id = postId || articleId || "";
    const [comments, setComments] = useState<Comment[]>([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!id) { setLoading(false); return; }
        fetch(`/api/v1/blog/${id}/comments`)
            .then(r => r.ok ? r.json() : { comments: [] })
            .then(data => setComments(data.comments || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !id) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/v1/blog/${id}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });
            if (res.ok) {
                const data = await res.json();
                setComments(prev => [data.comment, ...prev]);
                setContent("");
            }
        } catch { /* ignore */ }
        setSubmitting(false);
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Comments ({comments.length})
            </h3>
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm"
                />
                <Button type="submit" size="sm" disabled={submitting || !content.trim()}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
            </form>
            <div className="space-y-4">
                {comments.map(comment => (
                    <div key={comment.id} className="rounded-lg border border-border p-4 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{comment.author?.username}</span>
                            <span className="text-muted-foreground">&middot;</span>
                            <span className="text-muted-foreground text-xs">
                                {new Date(comment.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
