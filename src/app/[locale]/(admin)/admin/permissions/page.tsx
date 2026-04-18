"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface Role {
    id: string;
    name: string;
    displayName: string;
    color: string | null;
    priority: number;
}

interface Grant {
    id: string;
    resource: string;
    resourceId: string | null;
    action: string;
    principalType: string;
    principalId: string;
    allow: boolean;
}

// Common resources to show in the matrix. Modules can have many — this is a curated subset
// that the admin can extend by adding their own grants below.
const COMMON_RESOURCES = [
    "blog.article",
    "blog.category",
    "store.product",
    "store.order",
    "store.category",
    "forum.topic",
    "forum.category",
    "tickets.ticket",
    "help.article",
    "custom-pages.page",
];

const ACTIONS = ["view", "create", "edit", "delete"];

export default function PermissionsMatrixPage() {
    const t = useTranslations("admin");
    const [roles, setRoles] = useState<Role[]>([]);
    const [grants, setGrants] = useState<Grant[]>([]);
    const [loading, setLoading] = useState(true);
    const [customResource, setCustomResource] = useState("");
    const [customResources, setCustomResources] = useState<string[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/v1/admin/resource-permissions");
            const data = await res.json();
            setRoles(data.roles || []);
            setGrants(data.grants || []);
        } catch {
            toast.error(t("permissions_loadFailed"));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const findGrant = (resource: string, action: string, roleId: string): Grant | undefined =>
        grants.find((g) => g.resource === resource && g.action === action && g.principalId === roleId && g.resourceId === null);

    const toggleGrant = async (resource: string, action: string, roleId: string) => {
        const existing = findGrant(resource, action, roleId);
        try {
            if (!existing) {
                // Create allow grant
                await fetch("/api/v1/admin/resource-permissions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        resource,
                        action,
                        principalType: "role",
                        principalId: roleId,
                        allow: true,
                    }),
                });
            } else if (existing.allow) {
                // Toggle to deny
                await fetch("/api/v1/admin/resource-permissions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        resource,
                        action,
                        principalType: "role",
                        principalId: roleId,
                        allow: false,
                    }),
                });
            } else {
                // Remove
                await fetch("/api/v1/admin/resource-permissions", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        resource,
                        action,
                        principalType: "role",
                        principalId: roleId,
                    }),
                });
            }
            fetchData();
        } catch {
            toast.error(t("permissions_updateFailed"));
        }
    };

    const addCustomResource = () => {
        const r = customResource.trim();
        if (!r) return;
        if (![...COMMON_RESOURCES, ...customResources].includes(r)) {
            setCustomResources([...customResources, r]);
        }
        setCustomResource("");
    };

    const removeCustomResource = (r: string) => {
        setCustomResources(customResources.filter((x) => x !== r));
    };

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    const allResources = [...COMMON_RESOURCES, ...customResources];
    const nonAdminRoles = roles.filter((r) => r.name !== "admin");

    return (
        <>
            <div className="mb-6">
                <h1 className="text-xl font-semibold">
                    {t("permissions_title")}
                </h1>
                <p className="text-muted-foreground">{t("permissions_subtitle")}</p>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>{t("permissions_addResource")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input
                            value={customResource}
                            onChange={(e) => setCustomResource(e.target.value)}
                            placeholder={t("permissions_resourcePlaceholder")}
                            className="max-w-sm"
                        />
                        <Button variant="outline" onClick={addCustomResource}>
                            <Plus className="w-4 h-4 mr-2" /> {t("common_add")}
                        </Button>
                    </div>
                    {customResources.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {customResources.map((r) => (
                                <button key={r} onClick={() => removeCustomResource(r)} className="px-2 py-1 bg-muted rounded text-xs flex items-center gap-1">
                                    {r} <X className="w-3 h-3" />
                                </button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {allResources.map((resource) => (
                <Card key={resource} className="mb-3">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-mono">{resource}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-2 pr-4">{t("permissions_role")}</th>
                                        {ACTIONS.map((a) => (
                                            <th key={a} className="text-center py-2 px-2 font-medium capitalize">{a}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {nonAdminRoles.map((role) => (
                                        <tr key={role.id} className="border-b border-border last:border-0">
                                            <td className="py-2 pr-4">
                                                <span className="font-medium" style={{ color: role.color || undefined }}>
                                                    {role.displayName || role.name}
                                                </span>
                                            </td>
                                            {ACTIONS.map((action) => {
                                                const g = findGrant(resource, action, role.id);
                                                const state = g ? (g.allow ? "allow" : "deny") : "default";
                                                return (
                                                    <td key={action} className="py-2 px-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleGrant(resource, action, role.id)}
                                                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                                                state === "allow" ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950 dark:text-green-300" :
                                                                state === "deny" ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300" :
                                                                "bg-muted text-muted-foreground hover:bg-muted/70"
                                                            }`}
                                                            title={t("permissions_clickHint")}
                                                        >
                                                            {state === "allow" ? `✓ ${t("permissions_allow")}` : state === "deny" ? `✗ ${t("permissions_deny")}` : "—"}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </>
    );
}
