"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Link, useRouter } from "@/core/lib/i18n/navigation";
import { CORE_PERMISSIONS } from "@/core/lib/permission-names";
import { writeError } from "@/core/lib/write-result";
import { toast } from "sonner";

/**
 * The role editor, on its own route.
 *
 * It used to be a card that unfolded above the list. On a site with two
 * hundred roles that means the thing you came to edit is pushed off the
 * screen, the browser's back button does not close it, and the URL of a role
 * you are halfway through configuring cannot be sent to anyone. A create or
 * edit screen is a place, so it gets an address: /admin/roles/new and
 * /admin/roles/<id>/edit.
 *
 * Both routes render this component. `role` decides which of the two it is.
 */

export interface RolePermission {
    id: string;
    name: string;
    module: string;
}

export interface RoleRecord {
    id: string;
    name: string;
    displayName: string;
    color: string | null;
    priority: number;
    isDefault: boolean;
    permissions: RolePermission[];
    _count: { users: number };
}

// Core permissions always shown; module permissions added dynamically. The
// names come from core so this screen and moduleSystem.getAllPermissions()
// cannot drift apart.
const corePermissions = [{ module: "admin", perms: [...CORE_PERMISSIONS] }];

export function RoleForm({ role }: { role?: RoleRecord }) {
    const t = useTranslations("admin");
    const commonT = useTranslations("common");
    const router = useRouter();

    const [availablePermissions, setAvailablePermissions] = useState(corePermissions);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: role?.name ?? "",
        displayName: role?.displayName ?? "",
        color: role?.color ?? "#6366f1",
        priority: role?.priority ?? 0,
        permissions: role?.permissions.map((p) => p.name) ?? ([] as string[]),
    });

    const isAdminRole = role?.name === "admin";

    useEffect(() => {
        // Permission groups come from the installed module manifests, so a
        // module's permissions appear here without core knowing their names.
        fetch("/api/v1/modules")
            .then((r) => r.json())
            .then((data) => {
                const modules = (data.modules || []).filter((m: { enabled: boolean }) => m.enabled);
                const modulePerms = modules
                    .filter((m: { permissions?: string[] }) => m.permissions && m.permissions.length > 0)
                    .map((m: { id: string; permissions: string[] }) => ({
                        module: m.id,
                        perms: m.permissions as string[],
                    }));
                setAvailablePermissions([...corePermissions, ...modulePerms]);
            })
            .catch(() => { /* keep core permissions only */ });
    }, []);

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
            const res = await fetch(role ? `/api/v1/roles/${role.id}` : "/api/v1/roles", {
                method: role ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const failed = await writeError(res, commonT("somethingWentWrong"), t);
            if (failed) {
                setError(failed);
                return;
            }
            toast.success(role ? t("roles_saved") : t("roles_created"));
            router.push("/admin/roles");
            router.refresh();
        } catch {
            setError(commonT("somethingWentWrong"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                <div>
                    <h1 className="text-xl font-semibold">
                        {role ? t("roles_editRole", { name: role.displayName }) : t("roles_newRole")}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t("roles_subtitle")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push("/admin/roles")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {commonT("back")}
                </Button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
            )}

            <Card>
                <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="role-name">{t("roles_internalName")} *</Label>
                                <Input
                                    id="role-name"
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z_]/g, "") })
                                    }
                                    placeholder="moderator"
                                    required
                                    disabled={isAdminRole}
                                />
                                <p className="text-xs text-muted-foreground mt-1">{t("roles_lowercaseHint")}</p>
                            </div>
                            <div>
                                <Label htmlFor="role-display-name">{t("roles_displayName")} *</Label>
                                <Input
                                    id="role-display-name"
                                    value={form.displayName}
                                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                                    placeholder={t("roles_namePlaceholder")}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="role-color">{t("roles_color")}</Label>
                                <div className="flex gap-2">
                                    <input
                                        id="role-color"
                                        aria-label={t("roles_color")}
                                        type="color"
                                        value={form.color}
                                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                                        className="w-11 h-11 rounded-lg border border-border cursor-pointer"
                                    />
                                    <Input
                                        value={form.color}
                                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                                        placeholder="#6366f1"
                                        aria-label={t("roles_color")}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="role-priority">{t("roles_priority")}</Label>
                                <Input
                                    id="role-priority"
                                    type="number"
                                    value={form.priority}
                                    onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                                    placeholder="0"
                                />
                                <p className="text-xs text-muted-foreground mt-1">{t("roles_priorityHint")}</p>
                            </div>
                        </div>

                        <div>
                            <Label className="mb-3 block">{t("roles_permissions")}</Label>
                            {isAdminRole ? (
                                <p className="text-sm text-muted-foreground">{t("roles_adminAllPerms")}</p>
                            ) : (
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {availablePermissions.map((group) => (
                                        <div key={group.module} className="border border-border rounded-lg p-3">
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

                        <div className="flex gap-2">
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("roles_saving")}
                                    </>
                                ) : role ? (
                                    t("roles_saveChanges")
                                ) : (
                                    t("roles_createRole")
                                )}
                            </Button>
                            <Link href="/admin/roles" className="inline-flex">
                                <Button type="button" variant="outline" disabled={saving}>
                                    {commonT("cancel")}
                                </Button>
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </>
    );
}
