"use client";

import { useState, useEffect, useMemo } from "react";

import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { ModuleWidgets } from "@/core/generated/module-registry";
import { useAllModules } from "@/core/providers/module-provider";

export default function WidgetSettingsPage() {
    const modules = useAllModules();

    // Build available widgets from registry, filtered to enabled modules
    const availableWidgets = useMemo(() =>
        ModuleWidgets
            .filter((w) => modules[w.module] === true)
            .map((w) => ({
                id: w.id,
                name: w.id.replace(/([A-Z])/g, " $1").trim(),
                description: `Widget from ${w.module} module`,
                module: w.module,
            })),
        [modules]
    );

    const [widgetConfig, setWidgetConfig] = useState<Record<string, boolean>>({});
    const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const s = data.settings || {};
                const config = s.widget_visibility || {};
                const widgetIds = availableWidgets.map((w) => w.id);
                const order = s.widget_order || widgetIds;

                const vis: Record<string, boolean> = {};
                availableWidgets.forEach((w) => { vis[w.id] = config[w.id] !== false; });
                setWidgetConfig(vis);
                setWidgetOrder(Array.isArray(order) ? order.filter((id: string) => widgetIds.includes(id)) : widgetIds);
                // Add any new widgets not in saved order
                const savedSet = new Set(Array.isArray(order) ? order : []);
                const missing = widgetIds.filter((id) => !savedSet.has(id));
                if (missing.length > 0) {
                    setWidgetOrder((prev) => [...prev, ...missing]);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [availableWidgets]);

    const toggle = (id: string) => {
        setWidgetConfig({ ...widgetConfig, [id]: !widgetConfig[id] });
    };

    const move = (id: string, dir: -1 | 1) => {
        const idx = widgetOrder.indexOf(id);
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= widgetOrder.length) return;
        const newOrder = [...widgetOrder];
        [newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]];
        setWidgetOrder(newOrder);
    };

    const handleDragStart = (idx: number) => {
        setDraggedIdx(idx);
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        setDragOverIdx(idx);
    };

    const handleDragLeave = () => {
        setDragOverIdx(null);
    };

    const handleDrop = (idx: number) => {
        if (draggedIdx === null || draggedIdx === idx) {
            setDraggedIdx(null);
            setDragOverIdx(null);
            return;
        }
        const newOrder = [...widgetOrder];
        const [moved] = newOrder.splice(draggedIdx, 1);
        newOrder.splice(idx, 0, moved);
        setWidgetOrder(newOrder);
        setDraggedIdx(null);
        setDragOverIdx(null);
    };

    const handleDragEnd = () => {
        setDraggedIdx(null);
        setDragOverIdx(null);
    };

    const save = async () => {
        setSaving(true);
        await fetch("/api/v1/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ widget_visibility: widgetConfig, widget_order: widgetOrder }),
        });
        toast.success("Widget settings saved");
        setSaving(false);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    const sortedWidgets = widgetOrder
        .map((id) => availableWidgets.find((w) => w.id === id))
        .filter(Boolean) as typeof availableWidgets;

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Sidebar Widgets</h1>
                <p className="text-muted-foreground">Toggle visibility and reorder homepage sidebar widgets</p>
            </div>

            <Card className="mb-6">
                <CardContent className="p-0">
                    <div className="divide-y">
                        {sortedWidgets.map((widget, idx) => (
                            <div
                                key={widget.id}
                                draggable
                                onDragStart={() => handleDragStart(idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDragLeave={handleDragLeave}
                                onDrop={() => handleDrop(idx)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center gap-4 p-4 transition-all ${draggedIdx === idx ? "opacity-40" : ""} ${dragOverIdx === idx && draggedIdx !== idx ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                            >
                                <div className="flex flex-col gap-0.5 cursor-grab active:cursor-grabbing">
                                    <button onClick={() => move(widget.id, -1)} className="text-muted-foreground hover:text-foreground text-xs">▲</button>
                                    <button onClick={() => move(widget.id, 1)} className="text-muted-foreground hover:text-foreground text-xs">▼</button>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium">{widget.name}</p>
                                    <p className="text-xs text-muted-foreground">{widget.description}</p>
                                </div>
                                <Button
                                    variant={widgetConfig[widget.id] ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => toggle(widget.id)}
                                >
                                    {widgetConfig[widget.id] ? <><Eye className="w-3 h-3 mr-1" /> Visible</> : <><EyeOff className="w-3 h-3 mr-1" /> Hidden</>}
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Button onClick={save} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : <><Check className="w-4 h-4 mr-2" /> Save</>}
            </Button>
        </>
    );
}
