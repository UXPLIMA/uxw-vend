"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import {
    Award,
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
    const tt = useTranslations("admin");
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
                toast.error("Failed to load trophies");
            }
        } catch {
            toast.error("Failed to load trophies");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrophies();
    }, [fetchTrophies]);

    const openCreate = () => {
        setEditing(null);
        setForm(BLANK_FORM);
        setModalOpen(true);
    };

    const openEdit = (t: AdminTrophy) => {
        setEditing(t);
        setForm({
            name: t.name,
            description: t.description || "",
            icon: t.icon || "Award",
            color: t.color || "#f59e0b",
            points: String(t.points),
            ruleType: t.ruleType || "event-count",
            ruleEvent: t.ruleEvent || "",
            ruleThreshold: String(t.ruleThreshold ?? 1),
            isActive: t.isActive,
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
            toast.error("Name is required");
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
                toast.error(data.error || "Save failed");
                return;
            }
            toast.success(editing ? "Trophy updated" : "Trophy created");
            if (payload.ruleEvent !== originalEvent) {
                await reloadEngine();
            }
            closeModal();
            fetchTrophies();
        } catch {
            toast.error("Save failed");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (t: AdminTrophy) => {
        const ok = await confirm({
            title: "Delete trophy",
            message: `Delete "${t.name}"? This also removes it from every user who earned it.`,
            variant: "danger",
            confirmText: "Delete",
        });
        if (!ok) return;
        try {
            const res = await fetch(`/api/v1/admin/trophies/${t.id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Trophy deleted");
                fetchTrophies();
            } else {
                toast.error("Delete failed");
            }
        } catch {
            toast.error("Delete failed");
        }
    };

    const toggleActive = async (t: AdminTrophy) => {
        try {
            const res = await fetch(`/api/v1/admin/trophies/${t.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !t.isActive }),
            });
            if (res.ok) {
                setTrophies((prev) =>
                    prev.map((x) => (x.id === t.id ? { ...x, isActive: !t.isActive } : x))
                );
                toast.success(!t.isActive ? "Trophy activated" : "Trophy deactivated");
                await reloadEngine();
            } else {
                toast.error("Failed to toggle");
            }
        } catch {
            toast.error("Failed to toggle");
        }
    };

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-500" />
                        {tt("sidebar_trophies")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {tt("trophies_description")}
                    </p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="w-4 h-4 mr-1" /> {tt.has("common_add") ? tt("common_add") : "Add"}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {trophies.length} trophy{trophies.length === 1 ? "" : "s"}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : trophies.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                            No trophies defined yet.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left text-muted-foreground">
                                        <th className="py-2 pr-3">Trophy</th>
                                        <th className="py-2 pr-3">Description</th>
                                        <th className="py-2 pr-3">Points</th>
                                        <th className="py-2 pr-3">Rule</th>
                                        <th className="py-2 pr-3">Earned</th>
                                        <th className="py-2 pr-3">Active</th>
                                        <th className="py-2 pr-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trophies.map((t) => (
                                        <tr key={t.id} className="border-b border-border/50">
                                            <td className="py-2 pr-3">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                                        style={{ backgroundColor: t.color || "#6366f1" }}
                                                    >
                                                        {(t.icon || t.name).slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{t.name}</div>
                                                        <div className="text-xs text-muted-foreground">{t.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2 pr-3 max-w-[240px] truncate text-muted-foreground">
                                                {t.description || "—"}
                                            </td>
                                            <td className="py-2 pr-3 font-medium">{t.points}</td>
                                            <td className="py-2 pr-3">
                                                {t.ruleEvent ? (
                                                    <div className="flex flex-col">
                                                        <code className="text-xs">{t.ruleEvent}</code>
                                                        <span className="text-xs text-muted-foreground">
                                                            x{t.ruleThreshold ?? 1}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Manual only</span>
                                                )}
                                            </td>
                                            <td className="py-2 pr-3">
                                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                    <Users className="w-3 h-3" />
                                                    {t._count?.users ?? 0}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleActive(t)}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                                        t.isActive
                                                            ? "bg-green-500/10 text-green-600"
                                                            : "bg-muted text-muted-foreground"
                                                    }`}
                                                    title={t.isActive ? "Deactivate" : "Activate"}
                                                >
                                                    <Power className="w-3 h-3" />
                                                    {t.isActive ? "Active" : "Inactive"}
                                                </button>
                                            </td>
                                            <td className="py-2 pr-3 text-right whitespace-nowrap">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEdit(t)}
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive"
                                                    onClick={() => handleDelete(t)}
                                                    title="Delete"
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
                                {editing ? "Edit trophy" : "New trophy"}
                            </h2>
                            <Button variant="ghost" size="sm" onClick={closeModal}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <Label>Name</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="First Post"
                                />
                            </div>
                            <div>
                                <Label>Description</Label>
                                <Textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Awarded for creating your first forum topic."
                                    rows={2}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Lucide icon</Label>
                                    <Input
                                        value={form.icon}
                                        onChange={(e) => setForm({ ...form, icon: e.target.value })}
                                        placeholder="Award"
                                    />
                                </div>
                                <div>
                                    <Label>Color (hex)</Label>
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
                                    <Label>Points</Label>
                                    <Input
                                        type="number"
                                        value={form.points}
                                        onChange={(e) => setForm({ ...form, points: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Rule type</Label>
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
                                <Label>Rule event</Label>
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
                                    Leave empty for manual awards only. Any hook event works.
                                </p>
                            </div>
                            <div>
                                <Label>Rule threshold</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={form.ruleThreshold}
                                    onChange={(e) => setForm({ ...form, ruleThreshold: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    How many matching events before the trophy is awarded.
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
                                    Active
                                </Label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-border">
                            <Button variant="outline" onClick={closeModal} disabled={saving}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving
                                    </>
                                ) : editing ? (
                                    "Save changes"
                                ) : (
                                    "Create"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
