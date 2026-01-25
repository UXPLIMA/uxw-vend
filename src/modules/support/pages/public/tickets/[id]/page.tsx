"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/core/components/ui/button";
import { Textarea } from "@/core/components/ui/textarea";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { ThemeSlot } from "@/core/components/theme-slot";
import StandardSidebarLayout from "@/core/components/layout/SidebarLayout";
import { formatRelativeTime } from "@/core/lib/utils";

interface Message {
    id: string;
    content: string;
    isStaffReply: boolean;
    createdAt: string;
    user: { id: string; username: string; avatar: string | null };
}

interface Ticket {
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
    department: { id: string; name: string; color: string | null };
    user: { id: string; username: string; avatar: string | null };
    assignedTo: { id: string; username: string; avatar: string | null } | null;
    messages: Message[];
}

const statusColors: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-yellow-100 text-yellow-700",
    WAITING_REPLY: "bg-purple-100 text-purple-700",
    RESOLVED: "bg-green-100 text-green-700",
    CLOSED: "bg-gray-100 text-gray-500",
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function TicketDetailPage({ params }: PageProps) {
    const { id } = use(params);
    const { data: session } = useSession();
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (session?.user) {
            fetch(`/api/v1/tickets/${id}`)
                .then((res) => {
                    if (!res.ok) throw new Error("Ticket not found");
                    return res.json();
                })
                .then((data) => {
                    setTicket(data);
                    setLoading(false);
                })
                .catch((err) => {
                    setError(err.message);
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [session, id]);

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reply.trim()) return;

        setSending(true);
        try {
            const res = await fetch(`/api/v1/tickets/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: reply }),
            });

            if (!res.ok) throw new Error("Failed to send reply");

            const message = await res.json();
            setTicket((prev) => prev ? {
                ...prev,
                messages: [...prev.messages, message],
                status: "OPEN",
            } : null);
            setReply("");
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to send reply");
        } finally {
            setSending(false);
        }
    };

    if (!session?.user) {
        return (
            <div className="min-h-screen flex flex-col bg-gray-100">
                <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
                <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />
                <main className="container mx-auto px-4 py-6 flex-1">
                    <div className="bg-white rounded-xl p-8 text-center">
                        <p className="text-gray-500 mb-4">Please login to view this ticket</p>
                        <Link href="/auth/login">
                            <Button>Login</Button>
                        </Link>
                    </div>
                </main>
                <ThemeSlot name="Footer" defaultComponent={<Footer />} />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="text-sm text-gray-500 mb-4">
                    <Link href="/" className="hover:text-blue-600">Home</Link>
                    <span className="mx-2">/</span>
                    <Link href="/support" className="hover:text-blue-600">Support</Link>
                    <span className="mx-2">/</span>
                    <span className="text-gray-700">Ticket</span>
                </div>

                {loading ? (
                    <div className="bg-white rounded-xl p-8 text-center">
                        <p className="text-gray-500">Loading ticket...</p>
                    </div>
                ) : error ? (
                    <div className="bg-white rounded-xl p-8 text-center">
                        <p className="text-red-500 mb-4">{error}</p>
                        <Link href="/support">
                            <Button variant="outline">Back to Support</Button>
                        </Link>
                    </div>
                ) : ticket ? (
                    <ThemeSlot
                        name="SidebarLayout"
                        defaultComponent={<StandardSidebarLayout sidebar={null as any} children={null} />}
                        props={{
                            children: (
                                <div className="space-y-4">
                                    {/* Ticket Header */}
                                    <div className="bg-white rounded-xl border border-gray-100 p-6">
                                        <h1 className="text-xl font-bold text-gray-900 mb-2">{ticket.subject}</h1>
                                        <div className="flex flex-wrap gap-3 text-sm">
                                            <span className={`px-2 py-1 rounded font-medium ${statusColors[ticket.status]}`}>
                                                {ticket.status.replace(/_/g, " ")}
                                            </span>
                                            <span className="text-gray-500">
                                                Priority: <strong>{ticket.priority}</strong>
                                            </span>
                                            <span className="text-gray-500">
                                                Department: <strong>{ticket.department.name}</strong>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Messages */}
                                    <div className="space-y-4">
                                        {ticket.messages.map((message) => (
                                            <div
                                                key={message.id}
                                                className={`bg-white rounded-xl border p-4 ${message.isStaffReply
                                                    ? "border-blue-200 bg-blue-50/50"
                                                    : "border-gray-100"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                                                        {message.user.avatar ? (
                                                            <img src={message.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            message.user.username.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-900">{message.user.username}</span>
                                                            {message.isStaffReply && (
                                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">Staff</span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-gray-500">{formatRelativeTime(message.createdAt)}</span>
                                                    </div>
                                                </div>
                                                <div className="text-gray-700 whitespace-pre-wrap">{message.content}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Reply Form */}
                                    {ticket.status !== "CLOSED" && (
                                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                                            <form onSubmit={handleReply}>
                                                <Textarea
                                                    value={reply}
                                                    onChange={(e) => setReply(e.target.value)}
                                                    placeholder="Write your reply..."
                                                    rows={4}
                                                    className="mb-3"
                                                />
                                                <Button type="submit" disabled={sending || !reply.trim()}>
                                                    {sending ? "Sending..." : "Send Reply"}
                                                </Button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            ),
                            sidebar: (
                                <div className="space-y-4">
                                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                                        <h3 className="font-bold text-gray-900 mb-3">Ticket Info</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Created</span>
                                                <span className="text-gray-900">{formatRelativeTime(ticket.createdAt)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Updated</span>
                                                <span className="text-gray-900">{formatRelativeTime(ticket.updatedAt)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Messages</span>
                                                <span className="text-gray-900">{ticket.messages.length}</span>
                                            </div>
                                            {ticket.assignedTo && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Assigned to</span>
                                                    <span className="text-gray-900">{ticket.assignedTo.username}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        }}
                    />
                ) : null}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
