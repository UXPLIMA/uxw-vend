"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/core/sdk/ui";
import { Loader2, MessageCircle, Send } from "lucide-react";

interface Comment {
    id: string;
    content: string;
    createdAt: string;
    moderationState?: string;
    author: { id: string; username: string; avatar?: string | null };
}

/**
 * The endpoint is `/blog/comments?articleId=`, not `/blog/<id>/comments`.
 * This component asked for the second one, which the manifest never declared:
 * the dispatcher answered 404, the `.then` swallowed it, and the section
 * rendered an empty comment list on every article while posting silently did
 * nothing. `validate-module` now fails a module whose components fetch a path
 * it does not route.
 */
export function CommentSection({ postId, articleId }: { postId?: string; articleId?: string }) {
    const id = postId || articleId || "";
    const t = useTranslations("blog");
    const locale = useLocale();
    const [comments, setComments] = useState<Comment[]>([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [pending, setPending] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!id) { setLoading(false); return; }
        fetch(`/api/v1/blog/comments?articleId=${encodeURIComponent(id)}`)
            .then(r => r.ok ? r.json() : [])
            .then(data => setComments(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !id) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/v1/blog/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content, articleId: id }),
            });
            if (res.ok) {
                const comment: Comment = await res.json();
                // A site that moderates manually files the comment as PENDING.
                // Showing it in the list would tell the author it is live when
                // a reload will not show it.
                if (comment.moderationState === "PENDING") setPending(true);
                else setComments(prev => [comment, ...prev]);
                setContent("");
            }
        } catch { /* ignore */ }
        setSubmitting(false);
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
                {t("comments")} ({comments.length})
            </h2>
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder={t("writeComment")}
                    aria-label={t("writeComment")}
                    className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm"
                />
                <Button type="submit" size="sm" disabled={submitting || !content.trim()} aria-label={t("postComment")}>
                    {submitting
                        ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        : <Send className="w-4 h-4" aria-hidden="true" />}
                </Button>
            </form>
            {pending && (
                <p className="text-sm text-muted-foreground" role="status">{t("commentPending")}</p>
            )}
            <div className="space-y-4">
                {comments.map(comment => (
                    <div key={comment.id} className="rounded-lg border border-border p-4 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{comment.author?.username}</span>
                            <span className="text-muted-foreground">&middot;</span>
                            <span className="text-muted-foreground text-xs">
                                {new Date(comment.createdAt).toLocaleDateString(locale)}
                            </span>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                    </div>
                ))}
                {comments.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("noComments")}</p>
                )}
            </div>
        </div>
    );
}
