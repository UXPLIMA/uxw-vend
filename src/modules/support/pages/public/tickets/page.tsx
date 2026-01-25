"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/core/components/ui/button";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { ThemeSlot } from "@/core/components/theme-slot";
import { formatRelativeTime } from "@/core/lib/utils";

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
    CLOSED: "bg-gray-100 text-gray-500",
};

const priorityColors: Record<string, string> = {
    LOW: "text-gray-500",
    MEDIUM: "text-blue-500",
    HIGH: "text-orange-500",
    URGENT: "text-red-500",
};

export default function SupportPage() {
    const { data: session } = useSession();
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
            setLoading(false);
        }
    }, [session]);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="text-sm text-gray-500 mb-4">
                    <Link href="/" className="hover:text-blue-600">Home</Link>
                    <span className="mx-2">/</span>
                    <span className="text-gray-700">Support</span>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">My Support Tickets</h1>
                    {session?.user && (
                        <Link href="/support/new">
                            <Button>New Ticket</Button>
                        </Link>
                    )}
                </div>

                {!session?.user ? (
                    <div className="bg-white rounded-xl p-8 text-center">
                        <p className="text-gray-500 mb-4">Please login to view and create support tickets</p>
                        <Link href="/auth/login">
                            <Button>Login</Button>
                        </Link>
                    </div>
                ) : loading ? (
                    <div className="bg-white rounded-xl p-8 text-center">
                        <p className="text-gray-500">Loading tickets...</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center">
                        <p className="text-gray-500 mb-4">You don't have any support tickets yet</p>
                        <Link href="/support/new">
                            <Button>Create Your First Ticket</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Messages</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {tickets.map((ticket) => (
                                    <tr key={ticket.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4">
                                            <Link href={`/support/${ticket.id}`} className="text-blue-600 hover:underline font-medium">
                                                {ticket.subject}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-600">
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
                                        <td className="px-4 py-4 text-sm text-gray-500">
                                            {formatRelativeTime(ticket.updatedAt)}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-600">
                                            {ticket._count.messages}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
