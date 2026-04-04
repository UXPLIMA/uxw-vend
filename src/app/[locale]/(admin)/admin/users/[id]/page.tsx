"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { ArrowLeft, Loader2, Check, Ban, ShieldCheck } from "lucide-react";
import { formatDate } from "@/core/lib/utils";

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

    const [user, setUser] = useState<UserDetail | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        username: "",
        email: "",
        roleId: "",
    });

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
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
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
                </div>
            </div>
        </>
    );
}
