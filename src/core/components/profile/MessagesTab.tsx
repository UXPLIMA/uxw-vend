"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Loader2, MessageSquare, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Participant {
    id: string;
    username: string;
    avatar: string | null;
}

interface ConversationListItem {
    id: string;
    title: string | null;
    participants: Participant[];
    lastMessage: { body: string; createdAt: string } | null;
    lastMessageAt: string | null;
    unreadCount: number;
}

interface Message {
    id: string;
    body: string;
    createdAt: string;
    author: Participant;
}

function relativeTime(date: string): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export function MessagesTab() {
    const t = useTranslations("profile");
    const [conversations, setConversations] = useState<ConversationListItem[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);

    const fetchConversations = async () => {
        setLoadingList(true);
        try {
            const res = await fetch("/api/v1/messages");
            const data = await res.json();
            setConversations(data.conversations || []);
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => { fetchConversations(); }, []);

    const openConversation = async (id: string) => {
        setActiveId(id);
        setLoadingMessages(true);
        try {
            const res = await fetch(`/api/v1/messages/${id}`);
            const data = await res.json();
            setMessages(data.messages || []);
            // Refresh list to clear unread count
            fetchConversations();
        } finally {
            setLoadingMessages(false);
        }
    };

    const sendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeId || !reply.trim()) return;
        setSending(true);
        try {
            const res = await fetch(`/api/v1/messages/${activeId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: reply.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setMessages([...messages, data.message]);
                setReply("");
                fetchConversations();
            } else {
                toast.error(t("failedToSend"));
            }
        } finally {
            setSending(false);
        }
    };

    if (activeId) {
        const conv = conversations.find((c) => c.id === activeId);
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <button onClick={() => { setActiveId(null); setMessages([]); }} className="text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        {conv?.participants.map((p) => p.username).join(", ") || t("conversation")}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loadingMessages ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : (
                        <>
                            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                                {messages.map((m) => {
                                    const isMe = !conv?.participants.some((p) => p.id === m.author.id);
                                    return (
                                        <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                            <div className={`max-w-[75%] rounded-lg px-3 py-2 ${
                                                isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                                            }`}>
                                                <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                                                <div className={`text-[10px] mt-1 ${isMe ? "opacity-70" : "text-muted-foreground"}`}>
                                                    {relativeTime(m.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {messages.length === 0 && (
                                    <p className="text-center text-sm text-muted-foreground py-4">{t("noMessagesYet")}</p>
                                )}
                            </div>
                            <form onSubmit={sendReply} className="flex gap-2">
                                <Input
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    placeholder={t("typeAMessage")}
                                    disabled={sending}
                                    className="flex-1"
                                />
                                <Button type="submit" disabled={sending || !reply.trim()}>
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </Button>
                            </form>
                        </>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    {t("messagesTitle")}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loadingList ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">{t("noConversationsYet")}</p>
                ) : (
                    <div className="space-y-1">
                        {conversations.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => openConversation(c.id)}
                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors"
                            >
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-semibold text-foreground flex-shrink-0">
                                    {c.participants[0]?.username[0]?.toUpperCase() || "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-medium text-foreground truncate">
                                            {c.participants.map((p) => p.username).join(", ")}
                                        </div>
                                        {c.lastMessageAt && (
                                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{relativeTime(c.lastMessageAt)}</span>
                                        )}
                                    </div>
                                    {c.lastMessage && (
                                        <div className="text-xs text-muted-foreground truncate">{c.lastMessage.body}</div>
                                    )}
                                </div>
                                {c.unreadCount > 0 && (
                                    <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                                        {c.unreadCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
