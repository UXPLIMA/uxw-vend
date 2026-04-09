"use client";

import { useEffect, useState } from "react";
import { Settings as SettingsIcon, ChevronUp, ChevronDown, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface DashboardWidget {
    id: string;
    visible: boolean;
    order: number;
}

interface AvailableWidget {
    id: string;
    label: string;
    description?: string;
    source: "core" | "module";
    moduleId?: string;
}

export function DashboardCustomizer() {
    const [open, setOpen] = useState(false);
    const [layout, setLayout] = useState<DashboardWidget[]>([]);
    const [available, setAvailable] = useState<AvailableWidget[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { confirm } = useConfirm();

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        fetch("/api/v1/admin/dashboard-layout")
            .then((r) => r.json())
            .then((d: { layout: DashboardWidget[]; available: AvailableWidget[] }) => {
                setLayout(d.layout || []);
                setAvailable(d.available || []);
            })
            .catch(() => toast.error("Failed to load dashboard layout"))
            .finally(() => setLoading(false));
    }, [open]);

    const toggle = (id: string) => {
        setLayout((prev) => prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
    };

    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= layout.length) return;
        const next = [...layout];
        [next[index], next[target]] = [next[target], next[index]];
        setLayout(next.map((w, i) => ({ ...w, order: i })));
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/v1/admin/dashboard-layout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ widgets: layout }),
            });
            if (!res.ok) throw new Error();
            toast.success("Dashboard layout saved");
            setOpen(false);
            window.location.reload();
        } catch {
            toast.error("Failed to save layout");
        } finally {
            setSaving(false);
        }
    };

    const reset = async () => {
        const ok = await confirm({
            title: "Reset dashboard layout?",
            message: "All widgets will be restored to their default order and visibility.",
            confirmText: "Reset",
            variant: "danger",
        });
        if (!ok) return;
        setSaving(true);
        try {
            const res = await fetch("/api/v1/admin/dashboard-layout", { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast.success("Dashboard layout reset");
            setOpen(false);
            window.location.reload();
        } catch {
            toast.error("Failed to reset layout");
        } finally {
            setSaving(false);
        }
    };

    const infoFor = (id: string) => available.find((a) => a.id === id);

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <SettingsIcon className="w-4 h-4 mr-2" />
                Customize
            </Button>

            {open && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Customize dashboard"
                >
                    <div
                        className="bg-card rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-border">
                            <h2 className="text-lg font-semibold">Customize dashboard</h2>
                            <p className="text-xs text-muted-foreground">Show, hide, and reorder widgets.</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {loading ? (
                                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
                            ) : (
                                layout.map((w, i) => {
                                    const info = infoFor(w.id);
                                    if (!info) return null;
                                    return (
                                        <div key={w.id} className="flex items-center gap-3 p-2 rounded border border-border">
                                            <div className="flex flex-col">
                                                <button
                                                    type="button"
                                                    onClick={() => move(i, -1)}
                                                    disabled={i === 0}
                                                    className="p-0.5 disabled:opacity-30 hover:bg-muted rounded"
                                                    aria-label={`Move ${info.label} up`}
                                                >
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => move(i, 1)}
                                                    disabled={i === layout.length - 1}
                                                    className="p-0.5 disabled:opacity-30 hover:bg-muted rounded"
                                                    aria-label={`Move ${info.label} down`}
                                                >
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <input
                                                type="checkbox"
                                                id={`widget-${w.id}`}
                                                checked={w.visible}
                                                onChange={() => toggle(w.id)}
                                                className="rounded"
                                            />
                                            <label htmlFor={`widget-${w.id}`} className="flex-1 text-sm cursor-pointer">
                                                <div className="font-medium">{info.label}</div>
                                                {info.description && (
                                                    <div className="text-xs text-muted-foreground">{info.description}</div>
                                                )}
                                            </label>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${info.source === "core" ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600"}`}>
                                                {info.source === "core" ? "Core" : info.moduleId}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="p-4 border-t border-border flex justify-between gap-2">
                            <Button variant="outline" size="sm" onClick={reset} disabled={saving}>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Reset
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={save} disabled={saving || loading}>
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
