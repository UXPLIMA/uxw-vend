"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Pagination } from "@/core/components/ui/pagination";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { Link } from "@/core/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/core/components/ui/native-select";
import { badgeClassName } from "@/core/components/ui/badge";
import { AdminPageHeader } from "@/core/components/admin/AdminPageHeader";

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

export default function ResourcePermissionsPage() {
    const t = useTranslations("admin");
    const commonT = useTranslations("common");

    const [grants, setGrants] = useState<Grant[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [resourceFilter, setResourceFilter] = useState("");
    const [principalFilter, setPrincipalFilter] = useState("");


    const { confirm } = useConfirm();

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
            }
        } finally {
            setLoading(false);
        }
    }, [page, resourceFilter, principalFilter]);

    useEffect(() => {
        fetchGrants();
    }, [fetchGrants]);

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
            <AdminPageHeader
                title={t("rp_title")}
                description={t("rp_subtitle")}
                actions={<>
                    <Link href="/admin/resource-permissions/new" className="inline-flex">
                        <Button>
                            <Plus className="w-4 h-4" /> {t("rp_grant")}
                        </Button>
                    </Link>
                </>}
            />

            <Card className="mb-4">
                <CardContent className="p-4 grid md:grid-cols-2 gap-3">
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
                        <NativeSelect
                            aria-label={t("rp_filterPrincipal")}
                            value={principalFilter}
                            onChange={(e) => {
                                setPage(1);
                                setPrincipalFilter(e.target.value);
                            }} className="w-full"
                        >
                            <option value="">{t("rp_all")}</option>
                            <option value="role">{t("rp_role")}</option>
                            <option value="user">{t("rp_user")}</option>
                        </NativeSelect>
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
                            <div className="px-4 py-2 flex items-center gap-3 border-b bg-muted/40">
                                <div className="flex-1 min-w-0 hidden md:grid grid-cols-5 gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    <span>{t("rp_resource")}</span>
                                    <span>{t("rp_resourceId")}</span>
                                    <span>{t("rp_action")}</span>
                                    <span>{t("rp_principalType")}</span>
                                    <span>{t("rp_effect")}</span>
                                </div>
                                <span className="md:hidden text-xs text-muted-foreground">
                                    {total} {t("rp_totalSuffix")}
                                </span>
                                <span className="w-9 shrink-0" aria-hidden="true" />
                            </div>
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
                                            className={badgeClassName(g.allow ? "success" : "danger", "uppercase font-mono w-fit")}
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
                                        className="text-destructive w-9 shrink-0 px-0"
                                        onClick={() => revokeGrant(g)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                    {!loading && grants.length > 0 && (
                        <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>
        </>
    );
}
