"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
    Plus,
    X,
    Loader2,
    Trash2,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";
import { writeError } from "@/core/lib/write-result";

interface Role {
    id: string;
    name: string;
    displayName: string | null;
    color: string | null;
}

interface Grant {
    id: string;
    resource: string;
    resourceId: string | null;
    action: string;
    principalType: string;
    principalId: string;
    principalLabel: string;
    allow: boolean;
    createdAt: string;
}

interface UserHit {
    id: string;
    username: string;
}

const ACTIONS = ["view", "create", "edit", "delete", "*"];

export default function ResourcePermissionsPage() {
    const t = useTranslations("admin");
    const commonT = useTranslations("common");

    const [grants, setGrants] = useState<Grant[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [resourceFilter, setResourceFilter] = useState("");
    const [principalFilter, setPrincipalFilter] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formResource, setFormResource] = useState("");
    const [formResourceId, setFormResourceId] = useState("");
    const [formAction, setFormAction] = useState("view");
    const [formPrincipalType, setFormPrincipalType] = useState<"role" | "user">("role");
    const [formRoleId, setFormRoleId] = useState("");
    const [formUserQuery, setFormUserQuery] = useState("");
    const [formUserHits, setFormUserHits] = useState<UserHit[]>([]);
    const [formSelectedUser, setFormSelectedUser] = useState<UserHit | null>(null);
    const [formAllow, setFormAllow] = useState("true");

    const { confirm } = useConfirm();
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchGrants = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("list", "1");
            params.set("page", String(page));
            if (resourceFilter) params.set("resource", resourceFilter);
            if (principalFilter) params.set("principalType", principalFilter);
            const res = await fetch(`/api/v1/admin/resource-permissions?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setGrants(data.grants || []);
                setPages(data.pages || 1);
                setTotal(data.total || 0);
                setRoles(data.roles || []);
            }
        } finally {
            setLoading(false);
        }
    }, [page, resourceFilter, principalFilter]);

    useEffect(() => {
        fetchGrants();
    }, [fetchGrants]);

    const searchUsers = (q: string) => {
        setFormUserQuery(q);
        setFormSelectedUser(null);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (!q.trim()) {
            setFormUserHits([]);
            return;
        }
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/v1/users?search=${encodeURIComponent(q)}&limit=10`);
                if (res.ok) {
                    const data = await res.json();
                    setFormUserHits(
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
        setFormResource("");
        setFormResourceId("");
        setFormAction("view");
        setFormPrincipalType("role");
        setFormRoleId("");
        setFormUserQuery("");
        setFormUserHits([]);
        setFormSelectedUser(null);
        setFormAllow("true");
    };

    const grantPermission = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formResource.trim()) {
            toast.error(t("rp_resourceRequired"));
            return;
        }
        const principalId =
            formPrincipalType === "role" ? formRoleId : formSelectedUser?.id || "";
        if (!principalId) {
            toast.error(t("rp_principalRequired"));
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/v1/admin/resource-permissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    resource: formResource.trim(),
                    resourceId: formResourceId.trim() || null,
                    action: formAction,
                    principalType: formPrincipalType,
                    principalId,
                    allow: formAllow === "true",
                }),
            });
            const failed = await writeError(res, commonT("somethingWentWrong"), t);
            if (failed) {
                toast.error(failed);
            } else {
                toast.success(t("rp_created"));
                resetForm();
                fetchGrants();
            }
        } finally {
            setSaving(false);
        }
    };

    const revokeGrant = async (g: Grant) => {
        const ok = await confirm({
            title: t("rp_revokeTitle"),
            message: t("rp_revokeConfirm"),
            variant: "danger",
            confirmText: t("rp_revoke"),
        });
        if (!ok) return;
        const res = await fetch(`/api/v1/admin/resource-permissions/${g.id}`, {
            method: "DELETE",
        });
        if (res.ok) {
            toast.success(t("rp_revoked"));
            fetchGrants();
        } else {
            toast.error(t("common_failed"));
        }
    };

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold">
                        {t("rp_title")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t("rp_subtitle")}
                    </p>
                </div>
                <Button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
                    {showForm ? (
                        <>
                            <X className="w-4 h-4 mr-2" /> {t("rp_cancel")}
                        </>
                    ) : (
                        <>
                            <Plus className="w-4 h-4 mr-2" /> {t("rp_grant")}
                        </>
                    )}
                </Button>
            </div>

            {showForm && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{t("rp_newTitle")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={grantPermission} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>{t("rp_resource")}</Label>
                                    <Input
                                        aria-label={t("rp_resource")}
                                        value={formResource}
                                        onChange={(e) => setFormResource(e.target.value)}
                                        placeholder="blog.article"
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>
                                        {t("rp_resourceId")}
                                    </Label>
                                    <Input
                                        aria-label={t("rp_resourceId")}
                                        value={formResourceId}
                                        onChange={(e) => setFormResourceId(e.target.value)}
                                        placeholder={t("rp_resourceIdPlaceholder")}
                                    />
                                </div>
                                <div>
                                    <Label>{t("rp_action")}</Label>
                                    <select
                                        aria-label={t("rp_action")}
                                        value={formAction}
                                        onChange={(e) => setFormAction(e.target.value)}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        {ACTIONS.map((a) => (
                                            <option key={a} value={a}>
                                                {a}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label>{t("rp_allow")}</Label>
                                    <select
                                        aria-label={t("rp_allow")}
                                        value={formAllow}
                                        onChange={(e) => setFormAllow(e.target.value)}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="true">{t("rp_allowOpt")}</option>
                                        <option value="false">{t("rp_denyOpt")}</option>
                                    </select>
                                </div>
                                <div>
                                    <Label>{t("rp_principalType")}</Label>
                                    <select
                                        aria-label={t("rp_principalType")}
                                        value={formPrincipalType}
                                        onChange={(e) =>
                                            setFormPrincipalType(e.target.value as "role" | "user")
                                        }
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="role">{t("rp_role")}</option>
                                        <option value="user">{t("rp_user")}</option>
                                    </select>
                                </div>
                                <div className="relative">
                                    {formPrincipalType === "role" ? (
                                        <>
                                            <Label>{t("rp_selectRole")}</Label>
                                            <select
                                                aria-label={t("rp_selectRole")}
                                                value={formRoleId}
                                                onChange={(e) => setFormRoleId(e.target.value)}
                                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                required
                                            >
                                                <option value="">
                                                    {t("rp_selectRolePlaceholder")}
                                                </option>
                                                {roles.map((r) => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.displayName || r.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </>
                                    ) : (
                                        <>
                                            <Label>{t("rp_searchUser")}</Label>
                                            <Input
                                                aria-label={t("rp_searchUser")}
                                                value={formUserQuery}
                                                onChange={(e) => searchUsers(e.target.value)}
                                                placeholder={t("rp_searchUserPlaceholder")}
                                                autoComplete="off"
                                            />
                                            {formSelectedUser && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {t("rp_selected")}:{" "}
                                                    <span className="font-medium">
                                                        {formSelectedUser.username}
                                                    </span>
                                                </p>
                                            )}
                                            {formUserHits.length > 0 && !formSelectedUser && (
                                                <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-56 overflow-y-auto">
                                                    {formUserHits.map((u) => (
                                                        <button
                                                            type="button"
                                                            key={u.id}
                                                            onClick={() => {
                                                                setFormSelectedUser(u);
                                                                setFormUserQuery(u.username);
                                                                setFormUserHits([]);
                                                            }}
                                                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                                                        >
                                                            {u.username}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                                        {t("rp_saving")}
                                    </>
                                ) : (
                                    t("rp_create")
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card className="mb-4">
                <CardContent className="p-4 grid md:grid-cols-3 gap-3">
                    <div>
                        <Label>{t("rp_filterResource")}</Label>
                        <Input
                            aria-label={t("rp_filterResource")}
                            value={resourceFilter}
                            onChange={(e) => {
                                setPage(1);
                                setResourceFilter(e.target.value);
                            }}
                            placeholder="blog.article"
                        />
                    </div>
                    <div>
                        <Label>{t("rp_filterPrincipal")}</Label>
                        <select
                            aria-label={t("rp_filterPrincipal")}
                            value={principalFilter}
                            onChange={(e) => {
                                setPage(1);
                                setPrincipalFilter(e.target.value);
                            }}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="">{t("rp_all")}</option>
                            <option value="role">{t("rp_role")}</option>
                            <option value="user">{t("rp_user")}</option>
                        </select>
                    </div>
                    <div className="flex items-end text-sm text-muted-foreground">
                        {total} {t("rp_totalSuffix")}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : grants.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            {t("rp_none")}
                        </p>
                    ) : (
                        <div className="divide-y">
                            {grants.map((g) => (
                                <div key={g.id} className="p-4 flex items-center gap-3">
                                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                                        <span
                                            className="font-mono text-xs truncate"
                                            title={g.resource}
                                        >
                                            {g.resource}
                                        </span>
                                        <span
                                            className="font-mono text-xs text-muted-foreground truncate"
                                            title={g.resourceId || ""}
                                        >
                                            {g.resourceId || t("rp_any")}
                                        </span>
                                        <span className="font-mono text-xs">{g.action}</span>
                                        <span className="text-xs">
                                            <span className="text-muted-foreground">
                                                {g.principalType}:
                                            </span>{" "}
                                            <span className="font-medium">{g.principalLabel}</span>
                                        </span>
                                        <span
                                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono w-fit ${
                                                g.allow
                                                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                                                    : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                            }`}
                                        >
                                            {g.allow
                                                ? t("rp_allow")
                                                : t("rp_deny")}
                                        </span>
                                    </div>
                                    <Button
                                        aria-label={commonT("delete")}
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive"
                                        onClick={() => revokeGrant(g)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                    {pages > 1 && (
                        <div className="flex items-center justify-between p-3 border-t">
                            <span className="text-xs text-muted-foreground">
                                {t("revisions_page")} {page} / {pages}
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    aria-label={commonT("previousPage")}
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onClick={() => setPage(page - 1)}
                                >
                                    <ChevronLeft className="w-3 h-3" />
                                </Button>
                                <Button
                                    aria-label={commonT("nextPage")}
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
