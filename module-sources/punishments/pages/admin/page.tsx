"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button, Card, CardContent, Input, Label, Pagination, usePagedRows, useConfirm, useFormRoute, NativeSelect } from "@/core/sdk/ui";
import { Link } from "@/core/sdk/navigation";
import { ArrowLeft, Loader2, Plus, Trash2, RotateCcw, Ban } from "lucide-react";
import { toast } from "sonner";
import { dateLocaleTag } from "@/core/sdk";

interface Punishment {
    id: string;
    playerName: string;
    playerUuid: string | null;
    type: string;
    reason: string | null;
    duration: string | null;
    active: boolean;
    punishedBy: string | null;
    createdAt: string;
    expiresAt: string | null;
}

const TYPE_OPTIONS = ["ban", "mute", "kick", "warning", "tempBan", "tempMute"];

export default function AdminPunishmentsPage() {
    const t = useTranslations("punishments");
    const commonT = useTranslations("common");
    const __locale = useLocale();
    const __dateTag = dateLocaleTag(__locale);
    const { confirm } = useConfirm();
    const [items, setItems] = useState<Punishment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "active" | "revoked">("all");
    const [saving, setSaving] = useState(false);
    // The punishment form is a screen at `?form=new`, not a card wedged
    // between the filters and the table.
    const { showForm, formHref, closeForm } = useFormRoute();
    const [form, setForm] = useState({
        playerName: "",
        type: "ban",
        reason: "",
        duration: "",
        expiresAt: "",
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/v1/punishments?limit=100");
            const data = await res.json();
            setItems(data.punishments || []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = items.filter(p =>
        filter === "all" ? true : filter === "active" ? p.active : !p.active
    );
    const paged = usePagedRows(filtered);

    const create = async () => {
        if (!form.playerName.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/v1/punishments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    playerName: form.playerName.trim(),
                    type: form.type,
                    reason: form.reason || null,
                    duration: form.duration || null,
                    expiresAt: form.expiresAt || null,
                }),
            });
            if (!res.ok) throw new Error("create failed");
            toast.success(t("adm_createdToast"));
            setForm({ playerName: "", type: "ban", reason: "", duration: "", expiresAt: "" });
            await load();
            closeForm();
        } catch {
            toast.error(t("adm_error"));
        } finally {
            setSaving(false);
        }
    };

    const revoke = async (id: string, restore = false) => {
        if (!restore && !(await confirm({ title: t("adm_revoke"), message: t("adm_revokeConfirm"), variant: "danger" }))) return;
        try {
            const res = await fetch(`/api/v1/punishments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: restore }),
            });
            if (!res.ok) throw new Error("revoke failed");
            toast.success(restore ? t("adm_restoredToast") : t("adm_revokedToast"));
            await load();
        } catch {
            toast.error(t("adm_error"));
        }
    };

    const remove = async (id: string) => {
        if (!(await confirm({ title: t("adm_delete"), message: t("adm_deleteConfirm"), confirmText: t("adm_delete"), variant: "danger" }))) return;
        try {
            const res = await fetch(`/api/v1/punishments/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("delete failed");
            toast.success(t("adm_deletedToast"));
            await load();
        } catch {
            toast.error(t("adm_error"));
        }
    };

    if (showForm) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-bold">{t("adm_newPunishment")}</h1>
                        <p className="text-muted-foreground">{t("adm_subtitle")}</p>
                    </div>
                    <Button variant="outline" onClick={closeForm}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> {commonT("back")}
                    </Button>
                </div>

                <Card>
                    <CardContent className="p-6 space-y-3">
                        <div className="grid md:grid-cols-2 gap-3">
                            <div>
                                <Label>{t("adm_playerName")}</Label>
                                <Input aria-label={t("adm_playerName")} value={form.playerName} onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))} />
                            </div>
                            <div>
                                <Label>{t("adm_type")}</Label>
                                <NativeSelect
                                    aria-label={t("adm_type")} className="w-full" inputSize="sm"
                                    value={form.type}
                                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                >
                                    {TYPE_OPTIONS.map(o => (
                                        <option key={o} value={o}>{t(o)}</option>
                                    ))}
                                </NativeSelect>
                            </div>
                            <div>
                                <Label>{t("adm_reason")}</Label>
                                <Input aria-label={t("adm_reason")} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
                            </div>
                            <div>
                                <Label>{t("adm_duration")}</Label>
                                <Input aria-label={t("adm_duration")} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="7d" />
                            </div>
                            <div className="md:col-span-2">
                                <Label>{t("adm_expiresAt")}</Label>
                                <Input aria-label={t("adm_expiresAt")} type="datetime-local" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={closeForm}>{commonT("cancel")}</Button>
                            <Button onClick={create} disabled={saving || !form.playerName.trim()}>
                                {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {t("adm_creating")}</> : t("adm_create")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{t("adm_title")}</h1>
                <p className="text-muted-foreground">{t("adm_subtitle")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
                    {t("adm_filterAll")}
                </Button>
                <Button variant={filter === "active" ? "default" : "outline"} size="sm" onClick={() => setFilter("active")}>
                    {t("adm_filterActive")}
                </Button>
                <Button variant={filter === "revoked" ? "default" : "outline"} size="sm" onClick={() => setFilter("revoked")}>
                    {t("adm_filterRevoked")}
                </Button>
                <div className="flex-1" />
                <Link href={formHref()} className="inline-flex">
                    <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" /> {t("adm_newPunishment")}
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {t("adm_empty")}
                    </CardContent>
                </Card>
            ) : (
                <div className="bg-card rounded-lg overflow-x-auto border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-2 text-left">{t("player")}</th>
                                <th className="px-4 py-2 text-left">{t("type")}</th>
                                <th className="px-4 py-2 text-left">{t("reason")}</th>
                                <th className="px-4 py-2 text-left">{t("date")}</th>
                                <th className="px-4 py-2 text-left">{t("status")}</th>
                                <th className="px-4 py-2 text-right" />
                            </tr>
                        </thead>
                        <tbody>
                            {paged.rows.map(p => (
                                <tr key={p.id} className="border-t">
                                    <td className="px-4 py-2 font-medium">{p.playerName}</td>
                                    <td className="px-4 py-2">{TYPE_OPTIONS.includes(p.type) ? t(p.type) : p.type}</td>
                                    <td className="px-4 py-2 text-muted-foreground">{p.reason || "-"}</td>
                                    <td className="px-4 py-2 text-muted-foreground">{new Date(p.createdAt).toLocaleString(__dateTag)}</td>
                                    <td className="px-4 py-2">
                                        {p.active ? (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">{t("active")}</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{t("revoked")}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="inline-flex gap-1">
                                            {p.active ? (
                                                <Button variant="ghost" size="sm" onClick={() => revoke(p.id, false)} title={t("adm_revoke")}>
                                                    <Ban className="w-4 h-4" />
                                                </Button>
                                            ) : (
                                                <Button variant="ghost" size="sm" onClick={() => revoke(p.id, true)} title={t("adm_unrevoke")}>
                                                    <RotateCcw className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(p.id)} title={t("adm_delete")}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Pagination page={paged.page} pages={paged.pages} total={paged.total} onPageChange={paged.setPage} />
                </div>
            )}
        </div>
    );
}
