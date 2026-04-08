"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { ArrowLeft, Loader2, Check, Ban, ShieldCheck, Download, Trash2, AlertTriangle, UserCog } from "lucide-react";
import { formatDate } from "@/core/lib/utils";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface UserDetail {
    id: string;
    email: string;
    username: string;
    avatar: string | null;
    locale: string;
    currency: string;
    createdAt: string;
    isBanned: boolean;
    banReason: string | null;
    bannedAt: string | null;
    role: { id: string; name: string; displayName: string; color: string | null } | null;
    _count: Record<string, number>;
}

interface Role {
    id: string;
    name: string;
    displayName: string;
}

export default function AdminUserDetailPage() {
    const params = useParams();
    const userId = params.id as string;
    const { data: session, update: updateSession } = useSession();
    const { confirm } = useConfirm();

    const [user, setUser] = useState<UserDetail | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [impersonating, setImpersonating] = useState(false);

    const [form, setForm] = useState({
        username: "",
        email: "",
        roleId: "",
    });

    // GDPR tooling
    const [exportingData, setExportingData] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteConfirmUsername, setDeleteConfirmUsername] = useState("");
    const [deleteReason, setDeleteReason] = useState("");
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const canImpersonate =
        !!session?.user &&
        !session.user.originalUserId &&
        session.user.id !== userId;

    const handleImpersonate = async () => {
        if (!user) return;
        const ok = await confirm({
            title: "Log in as this user?",
            message: `You are about to impersonate ${user.username}. Every action will be audited. You can return to your admin account at any time from the banner at the top of the page.`,
            confirmText: "Log in as user",
            cancelText: "Cancel",
            variant: "default",
        });
        if (!ok) return;

        setImpersonating(true);
        try {
            const res = await fetch("/api/v1/admin/impersonate/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(data.error || "Failed to start impersonation");
                return;
            }
            await updateSession({ impersonate: userId });
            toast.success(`Now logged in as ${user.username}`);
            window.location.href = "/";
        } catch {
            toast.error("Failed to start impersonation");
        } finally {
            setImpersonating(false);
        }
    };

    const handleExportUserData = async () => {
        setExportingData(true);
        try {
            const res = await fetch(`/api/v1/users/${userId}/export`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                toast.error(body.error || "Failed to export user data");
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const cd = res.headers.get("Content-Disposition") || "";
            const match = cd.match(/filename="([^"]+)"/);
            a.download = match?.[1] || `uxwvend-data-${userId}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("User data exported");
        } catch {
            toast.error("Failed to export user data");
        } finally {
            setExportingData(false);
        }
    };

    const handleDeleteUser = async () => {
        setDeleteError("");
        setDeletingAccount(true);
        try {
            const res = await fetch(`/api/v1/users/${userId}/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    confirmUsername: deleteConfirmUsername,
                    reason: deleteReason || undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setDeleteError(data.error || "Failed to delete user");
                return;
            }
            toast.success("User account deleted");
            setDeleteModalOpen(false);
            window.location.reload();
        } catch {
            setDeleteError("Something went wrong");
        } finally {
            setDeletingAccount(false);
        }
    };

    useEffect(() => {
        Promise.all([
            fetch(`/api/v1/users/${userId}`).then((r) => r.json()),
            fetch("/api/v1/roles").then((r) => r.json()),
        ]).then(([userData, rolesData]) => {
            if (userData.user) {
                setUser(userData.user);
                setForm({
                    username: userData.user.username,
                    email: userData.user.email,
                    roleId: userData.user.role?.id || "",
                });
            }
            setRoles(rolesData.roles || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [userId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSaved(false);

        try {
            const res = await fetch(`/api/v1/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to update user");
                return;
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">User not found</p>
                <Link href="/admin/users">
                    <Button variant="outline" className="mt-4">Back to Users</Button>
                </Link>
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/users">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden">
                        {user.avatar ? (
                            <Image src={user.avatar} alt="" width={48} height={48} className="w-full h-full object-cover" unoptimized />
                        ) : (
                            user.username[0].toUpperCase()
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{user.username}</h1>
                        <p className="text-muted-foreground text-sm">{user.email}</p>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Edit Form */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>User Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {error && (
                                <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg">{error}</div>
                            )}
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <Label>Username</Label>
                                    <Input
                                        value={form.username}
                                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Email</Label>
                                    <Input
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Role</Label>
                                    <select
                                        value={form.roleId}
                                        onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="">No role</option>
                                        {roles.map((role) => (
                                            <option key={role.id} value={role.id}>{role.displayName}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button type="submit" disabled={saving}>
                                    {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> :
                                     saved ? <><Check className="w-4 h-4 mr-2" /> Saved</> : "Save Changes"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Info Sidebar */}
                <div className="space-y-6">
                    {(() => {
                        const counts = user._count || {};
                        const statItems = Object.entries(counts)
                            .filter(([, v]) => (v as number) > 0)
                            .map(([key, value]) => ({
                                label: key.charAt(0).toUpperCase() + key.slice(1),
                                value,
                            }));
                        if (statItems.length === 0) return null;
                        return (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Activity</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {statItems.map((stat) => (
                                        <div key={stat.label} className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">
                                                {stat.label}
                                            </span>
                                            <span className="font-medium">{stat.value}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        );
                    })()}

                    <Card>
                        <CardHeader>
                            <CardTitle>Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Locale</span>
                                <span>{user.locale}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Currency</span>
                                <span>{user.currency}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Joined</span>
                                <span>{formatDate(new Date(user.createdAt))}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Ban/Unban */}
                    <Card className={user.isBanned ? "border-red-200" : ""}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {user.isBanned ? <Ban className="w-4 h-4 text-red-500" /> : <ShieldCheck className="w-4 h-4 text-green-500" />}
                                {user.isBanned ? "Banned" : "Account Active"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {user.isBanned ? (
                                <div>
                                    {user.banReason && (
                                        <p className="text-sm text-muted-foreground mb-2">Reason: {user.banReason}</p>
                                    )}
                                    {user.bannedAt && (
                                        <p className="text-xs text-muted-foreground mb-3">Since: {formatDate(new Date(user.bannedAt))}</p>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            await fetch(`/api/v1/users/${userId}`, {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ isBanned: false }),
                                            });
                                            window.location.reload();
                                        }}
                                    >
                                        <ShieldCheck className="w-3 h-3 mr-2" /> Unban User
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={async () => {
                                        const reason = prompt("Ban reason (optional):");
                                        if (reason === null) return;
                                        await fetch(`/api/v1/users/${userId}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ isBanned: true, banReason: reason || undefined }),
                                        });
                                        window.location.reload();
                                    }}
                                >
                                    <Ban className="w-3 h-3 mr-2" /> Ban User
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {canImpersonate && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserCog className="w-4 h-4 text-yellow-600" />
                                    Impersonate
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <p className="text-xs text-muted-foreground">
                                    Debug or support this user by logging in as them. Every
                                    impersonation is written to the activity log.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={handleImpersonate}
                                    disabled={impersonating || user.isBanned}
                                >
                                    {impersonating ? (
                                        <>
                                            <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                            Switching
                                        </>
                                    ) : (
                                        <>
                                            <UserCog className="w-3 h-3 mr-2" />
                                            Log in as this user
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Download className="w-4 h-4 text-blue-500" />
                                GDPR
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={handleExportUserData}
                                disabled={exportingData}
                            >
                                {exportingData ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                        Preparing
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-3 h-3 mr-2" />
                                        Export data
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                    setDeleteConfirmUsername("");
                                    setDeleteReason("");
                                    setDeleteError("");
                                    setDeleteModalOpen(true);
                                }}
                            >
                                <Trash2 className="w-3 h-3 mr-2" />
                                Delete account
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {deleteModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center"
                    role="presentation"
                >
                    <div
                        className="fixed inset-0 bg-black/50"
                        onClick={() => !deletingAccount && setDeleteModalOpen(false)}
                        aria-hidden="true"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-delete-title"
                        className="relative bg-card border border-[var(--ux-border)] rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
                    >
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
                            </div>
                            <div>
                                <h3
                                    id="admin-delete-title"
                                    className="font-semibold text-foreground"
                                >
                                    Delete {user.username}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    This anonymises the user row and purges
                                    private data (sessions, messages, cart).
                                    Public contributions are preserved.
                                </p>
                            </div>
                        </div>

                        {deleteError && (
                            <div className="mb-3 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                                {deleteError}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <Label>
                                    Type{" "}
                                    <span className="font-mono text-red-600">
                                        {user.username}
                                    </span>{" "}
                                    to confirm
                                </Label>
                                <Input
                                    value={deleteConfirmUsername}
                                    onChange={(e) =>
                                        setDeleteConfirmUsername(e.target.value)
                                    }
                                    placeholder={user.username}
                                />
                            </div>
                            <div>
                                <Label>Reason (optional)</Label>
                                <Input
                                    value={deleteReason}
                                    onChange={(e) => setDeleteReason(e.target.value)}
                                    placeholder="e.g. GDPR request ticket #123"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteModalOpen(false)}
                                disabled={deletingAccount}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDeleteUser}
                                disabled={
                                    deletingAccount ||
                                    deleteConfirmUsername !== user.username
                                }
                            >
                                {deletingAccount ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                        Deleting
                                    </>
                                ) : (
                                    "Delete account"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
