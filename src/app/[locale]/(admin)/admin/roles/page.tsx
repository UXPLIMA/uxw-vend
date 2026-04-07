"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Plus, X, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface Permission {
    id: string;
    name: string;
    module: string;
}

interface Role {
    id: string;
    name: string;
    displayName: string;
    color: string | null;
    priority: number;
    isDefault: boolean;
    permissions: Permission[];
    _count: { users: number };
}

// Core permissions always shown; module permissions added dynamically
const corePermissions = [
    { module: "admin", perms: ["admin.access", "admin.settings", "admin.users", "admin.roles"] },
];

export default function AdminRolesPage() {
    const t = useTranslations("admin");
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [availablePermissions, setAvailablePermissions] = useState(corePermissions);
    const { confirm } = useConfirm();
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        displayName: "",
        color: "#6366f1",
        priority: 0,
        permissions: [] as string[],
    });

    const fetchRoles = async () => {
        try {
            const res = await fetch("/api/v1/roles");
            if (res.ok) {
                const data = await res.json();
                setRoles(data.roles || []);
            }
        } catch (err) {
            console.error("Failed to fetch roles:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
        // Build permission groups dynamically from module manifests
        fetch("/api/v1/modules")
            .then((r) => r.json())
            .then((data) => {
                const modules = (data.modules || []).filter((m: { enabled: boolean }) => m.enabled);
                const modulePerms = modules
                    .filter((m: { permissions?: string[] }) => m.permissions && m.permissions.length > 0)
                    .map((m: { id: string; permissions: string[] }) => ({ module: m.id, perms: m.permissions as string[] }));
                setAvailablePermissions([...corePermissions, ...modulePerms]);
            })
            .catch(() => { /* keep core permissions only */ });
    }, []);

    const resetForm = () => {
        setForm({ name: "", displayName: "", color: "#6366f1", priority: 0, permissions: [] });
        setEditingRole(null);
        setShowCreateForm(false);
        setError(null);
    };

    const startEdit = (role: Role) => {
        setEditingRole(role);
        setShowCreateForm(true);
        setForm({
            name: role.name,
            displayName: role.displayName,
            color: role.color || "#6366f1",
            priority: role.priority,
            permissions: role.permissions.map((p) => p.name),
        });
    };

    const togglePermission = (perm: string) => {
        setForm((prev) => ({
            ...prev,
            permissions: prev.permissions.includes(perm)
                ? prev.permissions.filter((p) => p !== perm)
                : [...prev.permissions, perm],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const url = editingRole ? `/api/v1/roles/${editingRole.id}` : "/api/v1/roles";
            const method = editingRole ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to save role");
                return;
            }

            resetForm();
            fetchRoles();
        } catch {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const deleteRole = async (roleId: string) => {
        const ok = await confirm({ title: t("roles_deleteTitle"), message: t("roles_deleteMessage"), variant: "danger", confirmText: "Delete" });
        if (!ok) return;

        try {
            const res = await fetch(`/api/v1/roles/${roleId}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "Failed to delete role");
                return;
            }
            fetchRoles();
        } catch {
            toast.error("Failed to delete role");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("roles_title")}</h1>
                    <p className="text-muted-foreground">{t("roles_subtitle")}</p>
                </div>
                <Button onClick={() => { resetForm(); setShowCreateForm(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> {t("roles_newRole")}
                </Button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
            )}

            {/* Create/Edit Form */}
            {showCreateForm && (
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>{editingRole ? t("roles_editRole", { name: editingRole.displayName }) : t("roles_newRole")}</span>
                            <Button variant="ghost" size="icon" onClick={resetForm}>
                                <X className="w-4 h-4" />
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>{t("roles_internalName")} *</Label>
                                    <Input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z_]/g, "") })}
                                        placeholder="moderator"
                                        required
                                        disabled={editingRole?.name === "admin"}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">{t("roles_lowercaseHint")}</p>
                                </div>
                                <div>
                                    <Label>{t("roles_displayName")} *</Label>
                                    <Input
                                        value={form.displayName}
                                        onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                                        placeholder="Moderator"
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>{t("roles_color")}</Label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={form.color}
                                            onChange={(e) => setForm({ ...form, color: e.target.value })}
                                            className="w-10 h-10 rounded cursor-pointer"
                                        />
                                        <Input
                                            value={form.color}
                                            onChange={(e) => setForm({ ...form, color: e.target.value })}
                                            placeholder="#6366f1"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>{t("roles_priority")}</Label>
                                    <Input
                                        type="number"
                                        value={form.priority}
                                        onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                                        placeholder="0"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">{t("roles_priorityHint")}</p>
                                </div>
                            </div>

                            {/* Permissions */}
                            <div>
                                <Label className="mb-3 block">{t("roles_permissions")}</Label>
                                {editingRole?.name === "admin" ? (
                                    <p className="text-sm text-muted-foreground">{t("roles_adminAllPerms")}</p>
                                ) : (
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {availablePermissions.map((group) => (
                                            <div key={group.module} className="border rounded-lg p-3">
                                                <p className="text-sm font-medium mb-2 capitalize">{group.module}</p>
                                                <div className="space-y-1">
                                                    {group.perms.map((perm) => (
                                                        <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={form.permissions.includes(perm)}
                                                                onChange={() => togglePermission(perm)}
                                                                className="rounded"
                                                            />
                                                            <span className="text-muted-foreground">{perm}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("roles_saving")}</>
                                ) : editingRole ? (
                                    t("roles_saveChanges")
                                ) : (
                                    t("roles_createRole")
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Roles List */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map((role) => (
                    <Card key={role.id} className="relative">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Shield
                                        className="w-5 h-5"
                                        style={{ color: role.color || "#6366f1" }}
                                    />
                                    <span>{role.displayName}</span>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => startEdit(role)}>
                                        Edit
                                    </Button>
                                    {role.name !== "admin" && role.name !== "member" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive"
                                            onClick={() => deleteRole(role.id)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{t("roles_internalName")}</span>
                                    <code className="bg-muted px-2 py-0.5 rounded text-xs">{role.name}</code>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{t("roles_users")}</span>
                                    <span>{role._count.users}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{t("roles_priority")}</span>
                                    <span>{role.priority}</span>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">{t("roles_permissions")}</p>
                                    {role.name === "admin" ? (
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{t("roles_allPermissions")}</span>
                                    ) : role.permissions.length === 0 ? (
                                        <span className="text-xs text-muted-foreground">{t("roles_noPermissions")}</span>
                                    ) : (
                                        <div className="flex flex-wrap gap-1">
                                            {role.permissions.map((p) => (
                                                <span key={p.id} className="text-xs bg-muted px-2 py-0.5 rounded">
                                                    {p.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </>
    );
}
