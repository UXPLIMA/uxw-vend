"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Link } from "@/core/lib/i18n/navigation";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Button } from "@/core/components/ui/button";
import { Textarea } from "@/core/components/ui/textarea";
import { Card, CardContent } from "@/core/components/ui/card";
import { ArrowLeft, Pin, Lock, Eye, ThumbsUp, Send, Loader2 } from "lucide-react";
import { formatRelativeTime } from "@/core/lib/utils";

interface Post {
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; username: string; avatar: string | null };
    _count: { likes: number };
}

interface Topic {
    id: string;
    title: string;
    slug: string;
    content: string;
    isPinned: boolean;
    isLocked: boolean;
    views: number;
    createdAt: string;
    author: { id: string; username: string; avatar: string | null };
    category: { id: string; name: string; slug: string; color: string | null };
    posts: Post[];
    _count: { likes: number };
}

export default function TopicDetailPage() {
    const params = useParams();
    // Can be { slug: ["forum","topic","3","general"], params: "3/general" } etc
    const raw = params.params || params.slug;
    const segments = typeof raw === "string" ? raw.split("/") : Array.isArray(raw) ? raw : [String(raw)];
    const topicIdx = segments.indexOf("topic");
    const topicId = topicIdx >= 0 && segments[topicIdx + 1] ? segments[topicIdx + 1] : segments[0];

    const [topic, setTopic] = useState<Topic | null>(null);
    const [loading, setLoading] = useState(true);
    const [replyContent, setReplyContent] = useState("");
    const [sending, setSending] = useState(false);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);

    const fetchTopic = () => {
        fetch(`/api/v1/forum/topics/${topicId}`)
            .then((r) => r.json())
            .then((d) => {
                setTopic(d.topic || null);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchTopic();
        // Check like status
        fetch(`/api/v1/forum/topics/${topicId}/like`)
            .then((r) => r.json())
            .then((d) => { setLiked(d.liked); setLikeCount(d.count); })
            .catch(() => {});
    }, [topicId]);  // eslint-disable-line react-hooks/exhaustive-deps

    const toggleLike = async () => {
        if (!topic) return;
        try {
            const res = await fetch(`/api/v1/forum/topics/${topic.id}/like`, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setLiked(data.liked);
                setLikeCount(data.count);
            }
        } catch (err) {
            console.error("Failed to toggle like:", err);
        }
    };

    const submitReply = async () => {
        if (!replyContent.trim() || !topic) return;
        setSending(true);
        try {
            const res = await fetch(`/api/v1/forum/topics/${topic.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: replyContent }),
            });
            if (res.ok) {
                setReplyContent("");
                fetchTopic();
            }
        } catch (err) {
            console.error("Failed to post reply:", err);
        } finally {
            setSending(false);
        }
    };

    const renderAvatar = (user: { username: string; avatar: string | null }) => (
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm flex-shrink-0">
            {user.avatar ? (
                <Image src={user.avatar} alt="" width={40} height={40} className="w-full h-full rounded-full object-cover" />
            ) : (
                user.username[0].toUpperCase()
            )}
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <HeroBanner />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-4xl">
                <Link href="/forum" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-blue-600 mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back to Forum
                </Link>

                {loading ? (
                    <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
                    </div>
                ) : !topic ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <p className="text-muted-foreground">Topic not found</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Topic Header */}
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                {topic.isPinned && <Pin className="w-4 h-4 text-blue-500" />}
                                {topic.isLocked && <Lock className="w-4 h-4 text-muted-foreground" />}
                                <h1 className="text-2xl font-bold text-foreground">{topic.title}</h1>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span
                                    className="px-2 py-0.5 rounded text-xs"
                                    style={{
                                        backgroundColor: (topic.category.color || "#6366f1") + "20",
                                        color: topic.category.color || "#6366f1",
                                    }}
                                >
                                    {topic.category.name}
                                </span>
                                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{topic.views} views</span>
                                <button
                                    onClick={toggleLike}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${liked ? "bg-blue-100 text-blue-600" : "hover:bg-muted"}`}
                                >
                                    <ThumbsUp className={`w-3 h-3 ${liked ? "fill-blue-600" : ""}`} />
                                    {likeCount} likes
                                </button>
                            </div>
                        </div>

                        {/* Original Post */}
                        <Card className="mb-4 border-l-4 border-l-blue-500">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-3 mb-4">
                                    {renderAvatar(topic.author)}
                                    <div>
                                        <p className="font-medium text-foreground">{topic.author.username}</p>
                                        <p className="text-xs text-muted-foreground">{formatRelativeTime(new Date(topic.createdAt))}</p>
                                    </div>
                                </div>
                                <div className="text-foreground whitespace-pre-wrap">{topic.content}</div>
                            </CardContent>
                        </Card>

                        {/* Replies */}
                        {topic.posts.length > 0 && (
                            <div className="space-y-3 mb-6">
                                <h3 className="text-sm font-medium text-muted-foreground">{topic.posts.length} replies</h3>
                                {topic.posts.map((post) => (
                                    <PostCard key={post.id} post={post} renderAvatar={renderAvatar} />
                                ))}
                            </div>
                        )}

                        {/* Reply Form */}
                        {!topic.isLocked ? (
                            <Card>
                                <CardContent className="p-5">
                                    <h3 className="font-medium text-foreground mb-3">Reply</h3>
                                    <Textarea
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        placeholder="Write your reply..."
                                        rows={4}
                                        className="mb-3"
                                    />
                                    <Button onClick={submitReply} disabled={sending || !replyContent.trim()}>
                                        {sending ? (
                                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Posting...</>
                                        ) : (
                                            <><Send className="w-4 h-4 mr-2" /> Post Reply</>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                                <Lock className="w-4 h-4 inline mr-1" /> This topic is locked. No new replies can be posted.
                            </div>
                        )}
                    </>
                )}
            </main>

            <Footer />
        </div>
    );
}

function PostCard({ post, renderAvatar }: { post: Post; renderAvatar: (user: { username: string; avatar: string | null }) => React.ReactNode }) {
    const [postLiked, setPostLiked] = useState(false);
    const [postLikeCount, setPostLikeCount] = useState(post._count.likes);

    const togglePostLike = async () => {
        try {
            const res = await fetch(`/api/v1/forum/posts/${post.id}/like`, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setPostLiked(data.liked);
                setPostLikeCount(data.count);
            }
        } catch (err) {
            console.error("Failed to toggle post like:", err);
        }
    };

    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                    {renderAvatar(post.author)}
                    <div>
                        <p className="font-medium text-foreground text-sm">{post.author.username}</p>
                        <p className="text-xs text-muted-foreground">{formatRelativeTime(new Date(post.createdAt))}</p>
                    </div>
                </div>
                <div className="text-foreground text-sm whitespace-pre-wrap mb-3">{post.content}</div>
                <button
                    onClick={togglePostLike}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${postLiked ? "bg-blue-100 text-blue-600" : "text-muted-foreground hover:bg-muted hover:text-muted-foreground"}`}
                >
                    <ThumbsUp className={`w-3 h-3 ${postLiked ? "fill-blue-600" : ""}`} />
                    {postLikeCount}
                </button>
            </CardContent>
        </Card>
    );
}
