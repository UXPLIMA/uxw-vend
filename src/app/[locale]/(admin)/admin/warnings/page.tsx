"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import {
    AlertTriangle,
    Plus,
    X,
    Loader2,
    ShieldOff,
    Trash2,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

interface Warning {
    id: string;
    reason: string;
    points: number;
    expiresAt: string | null;
    isActive: boolean;
    createdAt: string;
    user: { id: string; username: string } | null;
    issuedBy: { id: string; username: string } | null;
}

interface UserHit {
    id: string;
    username: string;
}

export default function WarningsPage() {
    const t = useTranslations("admin");
    const fallback = (key: string, en: string) => (t.has(key) ? t(key) : en);

    const [warnings, setWarnings] = useState<Warning[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [userQuery, setUserQuery] = useState("");
    const [userHits, setUserHits] = useState<UserHit[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserHit | null>(null);
    const [reason, setReason] = useState("");
    const [points, setPoints] = useState("1");
    const [expiresAt, setExpiresAt] = useState("");

    const { confirm } = useConfirm();
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchWarnings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/admin/warnings?page=${page}`);
            if (res.ok) {
                const data = await res.json();
                setWarnings(data.warnings || []);
                setPages(data.pages || 1);
                setTotal(data.total || 0);
            }
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchWarnings();
    }, [fetchWarnings]);

    const searchUsers = (q: string) => {
        setUserQuery(q);
        setSelectedUser(null);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (!q.trim()) {
            setUserHits([]);
            return;
        }
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/v1/users?search=${encodeURIComponent(q)}&limit=10`);
                if (res.ok) {
                    const data = await res.json();
                    setUserHits(
                        (data.users || []).map((u: { id: string; username: string }) => ({
                            id: u.id,
                            username: u.username,
                        })),
                    );
                }
            } catch {
                /* ignore */
            }
        }, 250);
    };

    const resetForm = () => {
        setShowForm(false);
        setUserQuery("");
        setUserHits([]);
        setSelectedUser(null);
        setReason("");
        setPoints("1");
        setExpiresAt("");
    };

    const issueWarning = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) {
            toast.error(fallback("warnings_selectUser", "Please select a user."));
            return;
        }
        if (!reason.trim()) {
            toast.error(fallback("warnings_reasonRequired", "Reason is required."));
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/v1/admin/warnings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedUser.id,
                    reason: reason.trim(),
                    points: Number(points) || 1,
                    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                }),
            });
            if (res.ok) {
                toast.success(fallback("warnings_issued", "Warning issued."));
                resetForm();
                fetchWarnings();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed");
            }
        } finally {
            setSaving(false);
        }
    };

    const revoke = async (w: Warning) => {
        const ok = await confirm({
            title: fallback("warnings_revokeTitle", "Revoke warning"),
            message: fallback("warnings_revokeConfirm", "Mark this warning as inactive?"),
            variant: "danger",
            confirmText: fallback("warnings_revoke", "Revoke"),
        });
        if (!ok) return;
        const res = await fetch(`/api/v1/admin/warnings/${w.id}`, { method: "PATCH" });
        if (res.ok) {
            toast.success(fallback("warnings_revoked", "Warning revoked."));
            fetchWarnings();
        } else {
            toast.error("Failed");
        }
    };

    const deleteWarning = async (w: Warning) => {
        const ok = await confirm({
            title: fallback("warnings_deleteTitle", "Delete warning"),
            message: fallback("warnings_deleteConfirm", "Permanently delete this warning?"),
            variant: "danger",
        });
        if (!ok) return;
        const res = await fetch(`/api/v1/admin/warnings/${w.id}`, { method: "DELETE" });
        if (res.ok) {
            toast.success(fallback("warnings_deleted", "Warning deleted."));
            fetchWarnings();
        } else {
            toast.error("Failed");
        }
    };

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <AlertTriangle className="w-7 h-7" />
                        {fallback("warnings_title", "User Warnings")}
                    </h1>
                    <p className="text-muted-foreground">
                        {fallback(
                            "warnings_subtitle",
                            "Issue and review moderator warnings for users.",
                        )}
                    </p>
                </div>
                <Button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
                    {showForm ? (
                        <>
                            <X className="w-4 h-4 mr-2" /> {fallback("warnings_cancel", "Cancel")}
                        </>
                    ) : (
                        <>
                            <Plus className="w-4 h-4 mr-2" />{" "}
                            {fallback("warnings_issueButton", "Issue Warning")}
                        </>
                    )}
                </Button>
            </div>

            {showForm && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{fallback("warnings_newTitle", "New Warning")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={issueWarning} className="space-y-4">
                            <div className="relative">
                                <Label>{fallback("warnings_user", "User")}</Label>
                                <Input
                                    value={userQuery}
                                    onChange={(e) => searchUsers(e.target.value)}
                                    placeholder={fallback(
                                        "warnings_userPlaceholder",
                                        "Search by username or email",
                                    )}
                                    autoComplete="off"
                                />
                                {selectedUser && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {fallback("warnings_selected", "Selected")}:{" "}
                                        <span className="font-medium">{selectedUser.username}</span>
                                    </p>
                                )}
                                {userHits.length > 0 && !selectedUser && (
                                    <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-56 overflow-y-auto">
                                        {userHits.map((u) => (
                                            <button
                                                type="button"
                                                key={u.id}
                                                onClick={() => {
                                                    setSelectedUser(u);
                                                    setUserQuery(u.username);
                                                    setUserHits([]);
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                                            >
                                                {u.username}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <Label>{fallback("warnings_reason", "Reason")}</Label>
                                <Textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    required
                                />
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>{fallback("warnings_points", "Points")}</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={points}
                                        onChange={(e) => setPoints(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>{fallback("warnings_expiresAt", "Expires At")}</Label>
                                    <Input
                                        type="datetime-local"
                                        value={expiresAt}
                                        onChange={(e) => setExpiresAt(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                                        {fallback("warnings_issuing", "Issuing...")}
                                    </>
                                ) : (
                                    fallback("warnings_issue", "Issue Warning")
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : warnings.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            {fallback("warnings_none", "No warnings have been issued.")}
                        </p>
                    ) : (
                        <div className="divide-y">
                            {warnings.map((w) => (
                                <div key={w.id} className="p-4 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium">
                                                {w.user?.username || "—"}
                                            </span>
                                            <span
                                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                                                    w.isActive
                                                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                                        : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {w.isActive
                                                    ? fallback("warnings_active", "active")
                                                    : fallback("warnings_inactive", "revoked")}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {w.points} {fallback("warnings_pts", "pts")}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate">
                                            {w.reason}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {fallback("warnings_by", "by")}{" "}
                                            {w.issuedBy?.username || fallback("warnings_system", "system")}{" "}
                                            · {new Date(w.createdAt).toLocaleString()}
                                            {w.expiresAt && (
                                                <>
                                                    {" "}
                                                    · {fallback("warnings_expires", "expires")}{" "}
                                                    {new Date(w.expiresAt).toLocaleDateString()}
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        {w.isActive && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => revoke(w)}
                                                title={fallback("warnings_revoke", "Revoke")}
                                            >
                                                <ShieldOff className="w-3 h-3" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive"
                                            onClick={() => deleteWarning(w)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {pages > 1 && (
                        <div className="flex items-center justify-between p-3 border-t">
                            <span className="text-xs text-muted-foreground">
                                {total} · {fallback("revisions_page", "Page")} {page} / {pages}
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onClick={() => setPage(page - 1)}
                                >
                                    <ChevronLeft className="w-3 h-3" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= pages}
                                    onClick={() => setPage(page + 1)}
                                >
                                    <ChevronRight className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
