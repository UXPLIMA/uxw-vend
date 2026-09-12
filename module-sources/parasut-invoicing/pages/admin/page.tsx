"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, LoadFailed, Waiting, useConfirm } from "@/core/sdk/ui";
import { toast } from "sonner";

interface Owing {
    orderId: string;
    status: string;
    legalDocument: string;
    legalNumber: string | null;
    legalReason: string | null;
    reason: string | null;
    remoteNumber: string | null;
}

/**
 * The credentials, and the sales that still owe something.
 *
 * The list was an endpoint nothing rendered: an operator installed this
 * because they are obliged to issue invoices, and the orders that did not get
 * one were visible only to somebody calling the API by hand. Recording a sale
 * and putting a document in front of the tax authority are two steps, and
 * this is where the second one is asked for.
 */
export default function InvoicingSettingsPage() {
    const t = useTranslations("parasutInvoicing");
    const { confirm } = useConfirm();

    const [owing, setOwing] = useState<Owing[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch("/api/v1/parasut-invoicing/issue")
            .then((r) => { if (!r.ok) throw new Error("load failed"); return r.json(); })
            .then((d: { failures?: Owing[]; awaitingDocument?: Owing[] }) => {
                if (cancelled) return;
                setOwing([...(d.failures ?? []), ...(d.awaitingDocument ?? [])]);
                setFailed(false);
                setLoading(false);
            })
            .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
        return () => { cancelled = true; };
    }, [reloadKey]);

    const ask = async (orderId: string, action: "send" | "refresh") => {
        // Sending is irreversible: a document the authority has accepted is
        // cancelled by a procedure rather than by deleting a row here.
        if (action === "send" && !(await confirm({ title: t("adm_sendConfirmTitle"), message: t("adm_sendConfirm") }))) {
            return;
        }
        setBusy(orderId);
        try {
            const res = await fetch("/api/v1/parasut-invoicing/document", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId, action }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(t(`adm_error_${String(data.error ?? "unknown")}`));
                return;
            }
            toast.success(t(`adm_state_${String(data.state)}`));
            setReloadKey((k) => k + 1);
        } catch {
            toast.error(t("adm_error_unknown"));
        } finally {
            setBusy(null);
        }
    };

    const tone = (state: string) =>
        state === "approved" ? "success" : state === "refused" || state === "failed" ? "danger" : "warning";

    return (
        <>
            <SettingsForm
                title={t("adm_title")}
                subtitle={t("adm_subtitle")}
                fields={[
                    { key: "parasut_company_id", label: t("adm_companyId"), description: t("adm_companyIdDesc") },
                    { key: "parasut_client_id", label: t("adm_clientId") },
                    { key: "parasut_client_secret", label: t("adm_clientSecret"), type: "password" },
                    { key: "parasut_username", label: t("adm_username"), description: t("adm_usernameDesc") },
                    { key: "parasut_password", label: t("adm_password"), type: "password" },
                ]}
            />

            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>{t("adm_owingTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Waiting label={t("adm_owingTitle")} />
                    ) : failed ? (
                        <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
                    ) : owing.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">{t("adm_owingNone")}</p>
                    ) : (
                        <div className="divide-y divide-border">
                            {owing.map((row) => (
                                <div key={row.orderId} className="flex flex-wrap items-center gap-3 py-3">
                                    <span className="font-mono text-xs text-muted-foreground">{row.orderId}</span>
                                    <Badge tone={tone(row.legalDocument)}>{t(`adm_state_${row.legalDocument}`)}</Badge>
                                    {row.legalNumber && <span className="text-sm">{row.legalNumber}</span>}
                                    <span className="flex-1 text-sm text-muted-foreground">
                                        {row.legalReason ?? row.reason ?? ""}
                                    </span>
                                    {row.status === "recorded" && (
                                        <div className="flex gap-2">
                                            {(row.legalDocument === "not_requested" || row.legalDocument === "failed") ? (
                                                <Button
                                                    size="sm"
                                                    disabled={busy === row.orderId}
                                                    onClick={() => ask(row.orderId, "send")}
                                                >
                                                    {t("adm_send")}
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={busy === row.orderId}
                                                    onClick={() => ask(row.orderId, "refresh")}
                                                >
                                                    {t("adm_refresh")}
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
