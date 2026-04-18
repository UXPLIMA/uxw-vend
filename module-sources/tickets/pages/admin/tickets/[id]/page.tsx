"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Textarea } from "@/core/components/ui/textarea";
import { ArrowLeft, Loader2, Send } from "lucide-react";

interface Message {
    id: string;
    content: string;
    isStaffReply: boolean;
    createdAt: string;
    user: {
        id: string;
        username: string;
        avatar: string | null;
    };
}

interface Ticket {
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    department: { id: string; name: string; color: string | null };
    user: { id: string; username: string; avatar: string | null };
    assignedTo: { id: string; username: string } | null;
    messages: Message[];
}

const statusOptions = ["OPEN", "IN_PROGRESS", "WAITING_REPLY", "RESOLVED", "CLOSED"];
const priorityOptions = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const statusColors: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-yellow-100 text-yellow-700",
    WAITING_REPLY: "bg-purple-100 text-purple-700",
    RESOLVED: "bg-green-100 text-green-700",
    CLOSED: "bg-muted text-foreground",
};

const priorityColors: Record<string, string> = {
    LOW: "bg-muted text-foreground",
    MEDIUM: "bg-blue-100 text-blue-700",
    HIGH: "bg-orange-100 text-orange-700",
    URGENT: "bg-red-100 text-red-700",
};

interface PageProps {
    params: Promise<{ id: string; locale: string }>;
}

export default function AdminTicketDetailPage(props: PageProps) {
    const t = useTranslations("tickets");
    const params = use(props.params);
    const ticketId = params.id;

    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);
    const [replyContent, setReplyContent] = useState("");
    const [sending, setSending] = useState(false);
    const [updating, setUpdating] = useState(false);

    const fetchTicket = async () => {
        try {
            const res = await fetch(`/api/v1/tickets/${ticketId}`);
            if (res.ok) {
                const data = await res.json();
                setTicket(data);
            }
        } catch (err) {
            console.error("Failed to fetch ticket:", err);
        } finally {
            setLoading(false);
        }
    };

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        fetchTicket();
    }, [ticketId]);
    /* eslint-enable react-hooks/exhaustive-deps */

    const sendReply = async () => {
        if (!replyContent.trim()) return;
        setSending(true);
        try {
            const res = await fetch(`/api/v1/tickets/${ticketId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: replyContent, ticketId }),
            });
            if (res.ok) {
                setReplyContent("");
                fetchTicket();
            }
        } catch (err) {
            console.error("Failed to send reply:", err);
        } finally {
            setSending(false);
        }
    };

    const updateTicket = async (field: string, value: string) => {
        setUpdating(true);
        try {
            await fetch(`/api/v1/tickets/${ticketId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: value }),
            });
            fetchTicket();
        } catch (err) {
            console.error("Failed to update ticket:", err);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">{t("adm_ticketNotFound")}</p>
                <Link href="/admin/tickets">
                    <Button variant="outline" className="mt-4">{t("adm_backToTickets")}</Button>
                </Link>
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/tickets">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{ticket.subject}</h1>
                    <p className="text-sm text-muted-foreground">
                        by {ticket.user.username} · {new Date(ticket.createdAt).toLocaleDateString()}
                    </p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Messages */}
                <div className="lg:col-span-2 space-y-4">
                    {ticket.messages.map((msg) => (
                        <Card key={msg.id} className={msg.isStaffReply ? "border-l-4 border-l-blue-500" : ""}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                        {msg.user.username[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">
                                            {msg.user.username}
                                            {msg.isStaffReply && (
                                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Staff</span>
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(msg.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</div>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Reply Form */}
                    {ticket.status !== "CLOSED" && (
                        <Card>
                            <CardContent className="p-4">
                                <Textarea
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder={t("adm_writeReply")}
                                    rows={4}
                                    className="mb-3"
                                />
                                <Button onClick={sendReply} disabled={sending || !replyContent.trim()}>
                                    {sending ? (
                                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("adm_sending")}</>
                                    ) : (
                                        <><Send className="w-4 h-4 mr-2" /> {t("adm_sendReply")}</>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("adm_details")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm text-muted-foreground block mb-1">{t("adm_status")}</label>
                                <select
                                    value={ticket.status}
                                    onChange={(e) => updateTicket("status", e.target.value)}
                                    disabled={updating}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    {statusOptions.map((s) => (
                                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground block mb-1">{t("adm_priority")}</label>
                                <select
                                    value={ticket.priority}
                                    onChange={(e) => updateTicket("priority", e.target.value)}
                                    disabled={updating}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    {priorityOptions.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t("adm_info")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("adm_department")}</span>
                                <span>{ticket.department.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("adm_status")}</span>
                                <span className={`text-xs px-2 py-1 rounded ${statusColors[ticket.status] || ""}`}>
                                    {ticket.status.replace("_", " ")}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("adm_priority")}</span>
                                <span className={`text-xs px-2 py-1 rounded ${priorityColors[ticket.priority] || ""}`}>
                                    {ticket.priority}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("adm_assignedTo")}</span>
                                <span>{ticket.assignedTo?.username || t("adm_unassigned")}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("adm_messages")}</span>
                                <span>{ticket.messages.length}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
