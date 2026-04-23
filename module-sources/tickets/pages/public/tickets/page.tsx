"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/core/components/ui/button";
import { Navbar, Footer } from "@/core/components/layout";
import { formatRelativeTime } from "@/core/lib/utils";
import { useTranslations } from "next-intl";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface Ticket {
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
    department: { id: string; name: string; color: string | null };
    _count: { messages: number };
}

const statusColors: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-yellow-100 text-yellow-700",
    WAITING_REPLY: "bg-purple-100 text-purple-700",
    RESOLVED: "bg-green-100 text-green-700",
    CLOSED: "bg-muted text-muted-foreground",
};

const priorityColors: Record<string, string> = {
    LOW: "text-muted-foreground",
    MEDIUM: "text-blue-500",
    HIGH: "text-orange-500",
    URGENT: "text-red-500",
};

export default function SupportPage() {
    const { data: session } = useSession();
    const t = useTranslations('tickets');
    const commonT = useTranslations('common');
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session?.user) {
            fetch("/api/v1/tickets")
                .then((res) => res.json())
                .then((data) => {
                    setTickets(data.tickets || []);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false);
        }
    }, [session]);

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" fallback={() => null} />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="text-sm text-muted-foreground mb-4">
                    <Link href="/" className="hover:text-blue-600">{commonT('home')}</Link>
                    <span className="mx-2">/</span>
                    <span className="text-foreground">{t('title')}</span>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-foreground">{t('myTickets')}</h1>
                    {session?.user && (
                        <Link href="/support/new">
                            <Button>{t('newTicket')}</Button>
                        </Link>
                    )}
                </div>

                {!session?.user ? (
                    <div className="bg-card rounded-xl p-8 text-center">
                        <p className="text-muted-foreground mb-4">{t('loginRequired')}</p>
                        <Link href="/auth/login">
                            <Button>{t('login')}</Button>
                        </Link>
                    </div>
                ) : loading ? (
                    <div className="bg-card rounded-xl p-8 text-center">
                        <p className="text-muted-foreground">{t('loadingTickets')}</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="bg-card rounded-xl p-8 text-center">
                        <p className="text-muted-foreground mb-4">{t('noTicketsYet')}</p>
                        <Link href="/support/new">
                            <Button>{t('createFirst')}</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('subject')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('department')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('status')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('priority')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('lastUpdated')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('messages')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {tickets.map((ticket) => (
                                    <tr key={ticket.id} className="hover:bg-muted">
                                        <td className="px-4 py-4">
                                            <Link href={`/support/${ticket.id}`} className="text-blue-600 hover:underline font-medium">
                                                {ticket.subject}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-muted-foreground">
                                            {ticket.department.name}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[ticket.status]}`}>
                                                {ticket.status.replace(/_/g, " ")}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`text-sm font-medium ${priorityColors[ticket.priority]}`}>
                                                {ticket.priority}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-muted-foreground">
                                            {formatRelativeTime(ticket.updatedAt)}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-muted-foreground">
                                            {ticket._count.messages}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
