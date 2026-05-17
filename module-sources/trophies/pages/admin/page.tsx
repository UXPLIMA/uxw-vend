"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import {
    Plus,
    X,
    Loader2,
    Trash2,
    Pencil,
    Power,
    Users,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

interface AdminTrophy {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    points: number;
    ruleType: string | null;
    ruleEvent: string | null;
    ruleThreshold: number | null;
    isActive: boolean;
    createdAt: string;
    _count?: { users: number };
}

const SUGGESTED_EVENTS = [
    "user.registered",
    "user.login",
    "forum.topic.created",
    "forum.post.created",
    "forum.topic.updated",
    "blog.article.created",
    "store.order.completed",
    "vote.vote.cast",
    "wheel.prize.won",
    "suggestions.suggestion.created",
    "tickets.ticket.opened",
    "custom-forms.submission.created",
    "downloads.file.downloaded",
    "credits.credit.added",
];

type FormState = {
    name: string;
    description: string;
    icon: string;
    color: string;
    points: string;
    ruleType: string;
    ruleEvent: string;
    ruleThreshold: string;
    isActive: boolean;
};

const BLANK_FORM: FormState = {
    name: "",
    description: "",
    icon: "Award",
    color: "#f59e0b",
    points: "10",
    ruleType: "event-count",
    ruleEvent: "",
    ruleThreshold: "1",
    isActive: true,
};

export default function AdminTrophiesPage() {
    const t = useTranslations("trophies");
    const tc = useTranslations("admin");
    const { confirm } = useConfirm();
    const [trophies, setTrophies] = useState<AdminTrophy[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AdminTrophy | null>(null);
    const [form, setForm] = useState<FormState>(BLANK_FORM);

    const fetchTrophies = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/v1/admin/trophies");
            if (res.ok) {
                const data = await res.json();
                setTrophies(data.trophies || []);
            } else {
                toast.error(t("loadFailed"));
            }
        } catch {
            toast.error(t("loadFailed"));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchTrophies();
    }, [fetchTrophies]);

    const openCreate = () => {
        setEditing(null);
        setForm(BLANK_FORM);
        setModalOpen(true);
    };

    const openEdit = (row: AdminTrophy) => {
        setEditing(row);
        setForm({
            name: row.name,
            description: row.description || "",
            icon: row.icon || "Award",
            color: row.color || "#f59e0b",
            points: String(row.points),
            ruleType: row.ruleType || "event-count",
            ruleEvent: row.ruleEvent || "",
            ruleThreshold: String(row.ruleThreshold ?? 1),
            isActive: row.isActive,
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditing(null);
    };

    const reloadEngine = async () => {
        try {
            await fetch("/api/v1/admin/trophies/reload", { method: "POST" });
        } catch {
            /* non-fatal */
        }
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error(t("nameRequired"));
            return;
        }
        setSaving(true);
        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            icon: form.icon.trim() || null,
            color: form.color.trim() || null,
            points: parseInt(form.points) || 0,
            ruleType: form.ruleType.trim() || "event-count",
            ruleEvent: form.ruleEvent.trim() || null,
            ruleThreshold: parseInt(form.ruleThreshold) || 1,
            isActive: form.isActive,
        };
        try {
            const originalEvent = editing?.ruleEvent || null;
            const res = await fetch(
                editing ? `/api/v1/admin/trophies/${editing.id}` : "/api/v1/admin/trophies",
                {
                    method: editing ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || t("saveFailed"));
                return;
            }
            toast.success(editing ? t("updated") : t("created"));
            if (payload.ruleEvent !== originalEvent) {
                await reloadEngine();
            }
            closeModal();
            fetchTrophies();
        } catch {
            toast.error(t("saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row: AdminTrophy) => {
        const ok = await confirm({
            title: t("deleteTitle"),
            message: t("deleteMessage", { name: row.name }),
            variant: "danger",
            confirmText: tc("common_delete"),
        });
        if (!ok) return;
        try {
            const res = await fetch(`/api/v1/admin/trophies/${row.id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success(t("deleted"));
                fetchTrophies();
            } else {
                toast.error(t("deleteFailed"));
            }
        } catch {
            toast.error(t("deleteFailed"));
        }
    };

    const toggleActive = async (row: AdminTrophy) => {
        try {
            const res = await fetch(`/api/v1/admin/trophies/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !row.isActive }),
            });
            if (res.ok) {
                setTrophies((prev) =>
                    prev.map((x) => (x.id === row.id ? { ...x, isActive: !row.isActive } : x))
                );
                toast.success(!row.isActive ? t("activated") : t("deactivated"));
                await reloadEngine();
            } else {
                toast.error(t("toggleFailed"));
            }
        } catch {
            toast.error(t("toggleFailed"));
        }
    };

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">
                        {t("title")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t("adm_description")}
                    </p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="w-4 h-4 mr-1" /> {tc("common_add")}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {trophies.length} {trophies.length === 1 ? t("trophy") : t("title")}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : trophies.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                            {t("noTrophies")}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left text-muted-foreground">
                                        <th className="py-2 pr-3">{t("trophy")}</th>
                                        <th className="py-2 pr-3">{tc("common_description")}</th>
                                        <th className="py-2 pr-3">{t("points")}</th>
                                        <th className="py-2 pr-3">{t("rule")}</th>
                                        <th className="py-2 pr-3">{t("earned")}</th>
                                        <th className="py-2 pr-3">{t("active")}</th>
                                        <th className="py-2 pr-3 text-right">{t("actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trophies.map((row) => (
                                        <tr key={row.id} className="border-b border-border/50">
                                            <td className="py-2 pr-3">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                                        style={{ backgroundColor: row.color || "#6366f1" }}
                                                    >
                                                        {(row.icon || row.name).slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{row.name}</div>
                                                        <div className="text-xs text-muted-foreground">{row.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2 pr-3 max-w-[240px] truncate text-muted-foreground">
                                                {row.description || "—"}
                                            </td>
                                            <td className="py-2 pr-3 font-medium">{row.points}</td>
                                            <td className="py-2 pr-3">
                                                {row.ruleEvent ? (
                                                    <div className="flex flex-col">
                                                        <code className="text-xs">{row.ruleEvent}</code>
                                                        <span className="text-xs text-muted-foreground">
                                                            x{row.ruleThreshold ?? 1}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">{t("manualOnly")}</span>
                                                )}
                                            </td>
                                            <td className="py-2 pr-3">
                                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                    <Users className="w-3 h-3" />
                                                    {row._count?.users ?? 0}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleActive(row)}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                                        row.isActive
                                                            ? "bg-green-500/10 text-green-600"
                                                            : "bg-muted text-muted-foreground"
                                                    }`}
                                                >
                                                    <Power className="w-3 h-3" />
                                                    {row.isActive ? t("activeLabel") : t("inactiveLabel")}
                                                </button>
                                            </td>
                                            <td className="py-2 pr-3 text-right whitespace-nowrap">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEdit(row)}
                                                    title={tc("common_edit")}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive"
                                                    onClick={() => handleDelete(row)}
                                                    title={tc("common_delete")}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-background border border-border rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-lg font-semibold">
                                {editing ? t("editTrophy") : t("newTrophy")}
                            </h2>
                            <Button variant="ghost" size="sm" onClick={closeModal}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <Label>{t("name")}</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="First Post"
                                />
                            </div>
                            <div>
                                <Label>{t("descriptionLabel")}</Label>
                                <Textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Awarded for creating your first forum topic."
                                    rows={2}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>{t("lucideIcon")}</Label>
                                    <Input
                                        value={form.icon}
                                        onChange={(e) => setForm({ ...form, icon: e.target.value })}
                                        placeholder="Award"
                                    />
                                </div>
                                <div>
                                    <Label>{t("color")}</Label>
                                    <div className="flex gap-2 items-center">
                                        <Input
                                            type="color"
                                            value={form.color}
                                            onChange={(e) => setForm({ ...form, color: e.target.value })}
                                            className="w-12 h-9 p-1"
                                        />
                                        <Input
                                            value={form.color}
                                            onChange={(e) => setForm({ ...form, color: e.target.value })}
                                            placeholder="#f59e0b"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>{t("points")}</Label>
                                    <Input
                                        type="number"
                                        value={form.points}
                                        onChange={(e) => setForm({ ...form, points: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>{t("ruleType")}</Label>
                                    <select
                                        value={form.ruleType}
                                        onChange={(e) => setForm({ ...form, ruleType: e.target.value })}
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                        <option value="event-count">event-count</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <Label>{t("ruleEvent")}</Label>
                                <Input
                                    list="trophy-event-suggestions"
                                    value={form.ruleEvent}
                                    onChange={(e) => setForm({ ...form, ruleEvent: e.target.value })}
                                    placeholder="forum.topic.created"
                                />
                                <datalist id="trophy-event-suggestions">
                                    {SUGGESTED_EVENTS.map((ev) => (
                                        <option key={ev} value={ev} />
                                    ))}
                                </datalist>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t("ruleEventHint")}
                                </p>
                            </div>
                            <div>
                                <Label>{t("ruleThreshold")}</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={form.ruleThreshold}
                                    onChange={(e) => setForm({ ...form, ruleThreshold: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t("thresholdHint")}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    id="trophy-active"
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <Label htmlFor="trophy-active" className="m-0 cursor-pointer">
                                    {t("activeLabel")}
                                </Label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-border">
                            <Button variant="outline" onClick={closeModal} disabled={saving}>
                                {tc("common_cancel")}
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-1" /> {t("saving")}
                                    </>
                                ) : editing ? (
                                    t("saveChanges")
                                ) : (
                                    tc("common_create")
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
