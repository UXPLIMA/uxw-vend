"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { formatRelativeTime } from "@/core/lib/utils";


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

export default function AdminTicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("");
    const [stats, setStats] = useState({ open: 0, inProgress: 0, waiting: 0, closed: 0 });

    useEffect(() => {
        const url = statusFilter
            ? `/api/v1/tickets?status=${statusFilter}`
            : "/api/v1/tickets";

        fetch(url)
            .then((res) => res.json())
            .then((data) => {
                setTickets(data.tickets || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [statusFilter]);

    useEffect(() => {
        // Fetch stats
        Promise.all([
            fetch("/api/v1/tickets?status=OPEN").then(r => r.json()),
            fetch("/api/v1/tickets?status=IN_PROGRESS").then(r => r.json()),
            fetch("/api/v1/tickets?status=WAITING_REPLY").then(r => r.json()),
            fetch("/api/v1/tickets?status=CLOSED").then(r => r.json()),
        ]).then(([open, inProgress, waiting, closed]) => {
            setStats({
                open: open.pagination?.total || 0,
                inProgress: inProgress.pagination?.total || 0,
                waiting: waiting.pagination?.total || 0,
                closed: closed.pagination?.total || 0,
            });
        }).catch(console.error);
    }, []);

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Support Tickets</h1>
                <p className="text-muted-foreground">Manage customer support tickets</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("OPEN")}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("IN_PROGRESS")}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("WAITING_REPLY")}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Waiting Reply</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-purple-600">{stats.waiting}</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("")}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Closed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-gray-600">{stats.closed}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter */}
            <div className="flex gap-2 mb-4">
                <Button
                    variant={statusFilter === "" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("")}
                >
                    All
                </Button>
                <Button
                    variant={statusFilter === "OPEN" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("OPEN")}
                >
                    Open
                </Button>
                <Button
                    variant={statusFilter === "IN_PROGRESS" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("IN_PROGRESS")}
                >
                    In Progress
                </Button>
                <Button
                    variant={statusFilter === "WAITING_REPLY" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("WAITING_REPLY")}
                >
                    Waiting Reply
                </Button>
            </div>

            {/* Tickets Table */}
            {loading ? (
                <div className="bg-card rounded-lg p-8 text-center">
                    <p className="text-muted-foreground">Loading tickets...</p>
                </div>
            ) : tickets.length === 0 ? (
                <div className="bg-card rounded-lg p-8 text-center">
                    <p className="text-muted-foreground">No tickets found</p>
                </div>
            ) : (
                <div className="bg-card rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Subject</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Department</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Priority</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Updated</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.map((ticket) => (
                                <tr key={ticket.id} className="hover:bg-muted/30">
                                    <td className="px-4 py-4">
                                        <Link href={`/admin/tickets/${ticket.id}`} className="text-primary hover:underline font-medium">
                                            {ticket.subject}
                                        </Link>
                                        <p className="text-xs text-muted-foreground">{ticket._count.messages} messages</p>
                                    </td>
                                    <td className="px-4 py-4 text-sm">
                                        {ticket.user.username}
                                    </td>
                                    <td className="px-4 py-4 text-sm">
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
                                    <td className="px-4 py-4">
                                        <Link href={`/admin/tickets/${ticket.id}`}>
                                            <Button size="sm" variant="ghost">View</Button>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
