"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Smartphone, Monitor, Trash2, Globe } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface UserSession {
    id: string;
    deviceInfo: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    lastActiveAt: string;
    createdAt: string;
    expiresAt: string;
}

function formatDate(d: string): string {
    return new Date(d).toLocaleString();
}

function detectDevice(ua: string | null): { icon: typeof Monitor; label: string } {
    if (!ua) return { icon: Globe, label: "Unknown device" };
    if (/iPhone|iPad|Android/i.test(ua)) return { icon: Smartphone, label: "Mobile" };
    return { icon: Monitor, label: "Desktop" };
}

export function SessionsTab() {
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [revoking, setRevoking] = useState<Set<string>>(new Set());
    const { confirm } = useConfirm();

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/v1/sessions");
            const data = await res.json();
            setSessions(data.sessions || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSessions(); }, []);

    const revoke = async (s: UserSession) => {
        const ok = await confirm({
            title: "Revoke session",
            message: "End this session? It will be signed out immediately.",
            variant: "danger",
        });
        if (!ok) return;
        setRevoking((set) => new Set(set).add(s.id));
        try {
            const res = await fetch(`/api/v1/sessions/${s.id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Session revoked");
                fetchSessions();
            } else {
                toast.error("Failed");
            }
        } finally {
            setRevoking((set) => {
                const next = new Set(set);
                next.delete(s.id);
                return next;
            });
        }
    };

    const revokeAll = async () => {
        const ok = await confirm({
            title: "Sign out everywhere",
            message: "Sign out of every device. You'll need to log in again on each.",
            variant: "danger",
        });
        if (!ok) return;
        const res = await fetch("/api/v1/sessions/revoke-all", { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            toast.success(`Revoked ${data.count} sessions`);
            // After revoking all, the current request will fail next time → user is logged out
            window.location.href = "/auth/login";
        }
    };

    if (loading) {
        return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Monitor className="w-5 h-5" />
                        Active Sessions
                    </span>
                    {sessions.length > 1 && (
                        <Button variant="outline" size="sm" onClick={revokeAll}>
                            Sign out everywhere
                        </Button>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                        Session tracking starts on your next login.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {sessions.map((s) => {
                            const device = detectDevice(s.userAgent);
                            const Icon = device.icon;
                            return (
                                <div key={s.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-foreground">
                                            {s.deviceInfo || device.label}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {s.ipAddress || "unknown IP"} · last active {formatDate(s.lastActiveAt)}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive"
                                        onClick={() => revoke(s)}
                                        disabled={revoking.has(s.id)}
                                    >
                                        {revoking.has(s.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
