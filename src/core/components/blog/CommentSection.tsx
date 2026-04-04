"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useModuleStatus } from "@/core/providers/module-provider";
import Link from "next/link";
import { Button } from "@/core/components/ui/button";
import { Textarea } from "@/core/components/ui/textarea";
import { formatRelativeTime } from "@/core/lib/utils";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { toast } from "sonner";

interface Comment {
    id: string;
    content: string;
    createdAt: string;
    author: {
        id: string;
        username: string;
        avatar: string | null;
    };
}

interface CommentSectionProps {
    articleId: string;
    initialComments?: Comment[];
}

export function CommentSection({ articleId, initialComments = [] }: CommentSectionProps) {
    const blogEnabled = useModuleStatus('blog');
    const { data: session } = useSession();

    const { confirm } = useConfirm();
    if (!blogEnabled) return null;
    const [comments, setComments] = useState<Comment[]>(initialComments);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch comments on mount if not provided
    useEffect(() => {
        if (initialComments.length === 0) {
            fetch(`/api/v1/blog/comments?articleId=${articleId}`)
                .then((res) => res.json())
                .then((data) => {
                    if (Array.isArray(data)) {
                        setComments(data);
                    } else {
                        console.error("Comments API returned non-array:", data);
                        setComments([]);
                    }
                })
                .catch(console.error);
        }
    }, [articleId, initialComments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newComment.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/v1/blog/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: newComment,
                    articleId,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to post comment");
            }

            const comment = await res.json();
            setComments([comment, ...comments]);
            setNewComment("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        const ok = await confirm({ title: "Delete Comment", message: "Are you sure you want to delete this comment?", variant: "danger", confirmText: "Delete" });
        if (!ok) return;

        try {
            const res = await fetch(`/api/v1/blog/comments/${commentId}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                throw new Error("Failed to delete comment");
            }

            setComments(comments.filter((c) => c.id !== commentId));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete comment");
        }
    };

    return (
        <div className="mt-8 pt-8 border-t border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
                Comments ({comments.length})
            </h3>

            {/* Comment Form */}
            {session?.user ? (
                <form onSubmit={handleSubmit} className="mb-8">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        rows={4}
                        className="mb-3"
                    />
                    <div className="flex justify-end">
                        <Button type="submit" disabled={loading || !newComment.trim()}>
                            {loading ? "Posting..." : "Post Comment"}
                        </Button>
                    </div>
                </form>
            ) : (
                <div className="mb-8 p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-gray-600 mb-2">Please login to leave a comment</p>
                    <Link href="/auth/login">
                        <Button variant="outline">Login</Button>
                    </Link>
                </div>
            )}

            {/* Comments List */}
            {comments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                    No comments yet. Be the first to comment!
                </p>
            ) : (
                <div className="space-y-6">
                    {comments.map((comment) => (
                        <div
                            key={comment.id}
                            className="flex gap-4 p-4 bg-gray-50 rounded-lg"
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold flex-shrink-0">
                                {comment.author.avatar ? (
                                    <img
                                        src={comment.author.avatar}
                                        alt={comment.author.username}
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                ) : (
                                    comment.author.username.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">
                                            {comment.author.username}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {formatRelativeTime(comment.createdAt)}
                                        </span>
                                    </div>
                                    {session?.user?.id === comment.author.id && (
                                        <button
                                            onClick={() => handleDelete(comment.id)}
                                            className="text-sm text-red-500 hover:text-red-700"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <p className="text-gray-700 whitespace-pre-wrap">
                                    {comment.content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
