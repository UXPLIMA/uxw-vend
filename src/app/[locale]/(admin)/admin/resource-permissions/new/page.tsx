"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { NativeSelect } from "@/core/components/ui/native-select";
import { UserPicker, type PickedUser } from "@/core/components/admin/UserPicker";
import { Link, useRouter } from "@/core/lib/i18n/navigation";
import { writeError } from "@/core/lib/write-result";
import { toast } from "sonner";
import { AdminPageHeader } from "@/core/components/admin/AdminPageHeader";

const ACTIONS = ["view", "create", "edit", "delete", "*"];

interface Role {
    id: string;
    name: string;
    displayName: string | null;
}

/** Granting a resource permission, on its own route. */
export default function NewResourcePermissionPage() {
    const t = useTranslations("admin");
    const commonT = useTranslations("common");
    const router = useRouter();

    const [roles, setRoles] = useState<Role[]>([]);
    const [resource, setResource] = useState("");
    const [resourceId, setResourceId] = useState("");
    const [action, setAction] = useState("view");
    const [principalType, setPrincipalType] = useState<"role" | "user">("role");
    const [roleId, setRoleId] = useState("");
    const [user, setUser] = useState<PickedUser | null>(null);
    const [allow, setAllow] = useState("true");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // The list endpoint returns the roles alongside the grants; this screen
        // only needs the roles, so it asks for one empty page of grants.
        fetch("/api/v1/admin/resource-permissions?list=1&page=1")
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
            .then((data: { roles?: Role[] }) => setRoles(data.roles || []))
            .catch(() => { /* the role picker stays empty and the form says so */ });
    }, []);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resource.trim()) {
            toast.error(t("rp_resourceRequired"));
            return;
        }
        const principalId = principalType === "role" ? roleId : user?.id || "";
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
                    resource: resource.trim(),
                    resourceId: resourceId.trim() || null,
                    action,
                    principalType,
                    principalId,
                    allow: allow === "true",
                }),
            });
            const failed = await writeError(res, commonT("somethingWentWrong"), t);
            if (failed) {
                toast.error(failed);
                return;
            }
            toast.success(t("rp_created"));
            router.push("/admin/resource-permissions");
            router.refresh();
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <AdminPageHeader
                title={t("rp_newTitle")}
                description={t("rp_subtitle")}
                backHref="/admin/resource-permissions"
                backLabel={commonT("back")}
            />

            <Card>
                <CardContent className="p-6">
                    <form onSubmit={submit} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="rp-resource">{t("rp_resource")}</Label>
                                <Input
                                    id="rp-resource"
                                    value={resource}
                                    onChange={(e) => setResource(e.target.value)}
                                    placeholder="blog.article"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="rp-resource-id">{t("rp_resourceId")}</Label>
                                <Input
                                    id="rp-resource-id"
                                    value={resourceId}
                                    onChange={(e) => setResourceId(e.target.value)}
                                    placeholder={t("rp_resourceIdPlaceholder")}
                                />
                            </div>
                            <div>
                                <Label htmlFor="rp-action">{t("rp_action")}</Label>
                                <NativeSelect
                                    id="rp-action"
                                    value={action}
                                    onChange={(e) => setAction(e.target.value)}
                                >
                                    {ACTIONS.map((a) => (
                                        <option key={a} value={a}>{a}</option>
                                    ))}
                                </NativeSelect>
                            </div>
                            <div>
                                <Label htmlFor="rp-allow">{t("rp_allow")}</Label>
                                <NativeSelect
                                    id="rp-allow"
                                    value={allow}
                                    onChange={(e) => setAllow(e.target.value)}
                                >
                                    <option value="true">{t("rp_allowOpt")}</option>
                                    <option value="false">{t("rp_denyOpt")}</option>
                                </NativeSelect>
                            </div>
                            <div>
                                <Label htmlFor="rp-principal-type">{t("rp_principalType")}</Label>
                                <NativeSelect
                                    id="rp-principal-type"
                                    value={principalType}
                                    onChange={(e) => setPrincipalType(e.target.value as "role" | "user")}
                                >
                                    <option value="role">{t("rp_role")}</option>
                                    <option value="user">{t("rp_user")}</option>
                                </NativeSelect>
                            </div>
                            {principalType === "role" ? (
                                <div>
                                    <Label htmlFor="rp-role">{t("rp_selectRole")}</Label>
                                    <NativeSelect
                                        id="rp-role"
                                        value={roleId}
                                        onChange={(e) => setRoleId(e.target.value)}
                                        required
                                    >
                                        <option value="">{t("rp_selectRolePlaceholder")}</option>
                                        {roles.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.displayName || r.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </div>
                            ) : (
                                <UserPicker
                                    id="rp-user"
                                    value={user}
                                    onChange={setUser}
                                    label={t("rp_searchUser")}
                                    placeholder={t("rp_searchUserPlaceholder")}
                                    required
                                />
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> {t("rp_saving")}
                                    </>
                                ) : (
                                    t("rp_create")
                                )}
                            </Button>
                            <Link href="/admin/resource-permissions" className="inline-flex">
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
