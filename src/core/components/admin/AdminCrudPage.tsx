"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Loader2, Plus, X, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

export interface CrudField {
    key: string;
    label: string;
    type?: "text" | "number" | "url" | "select" | "textarea" | "toggle" | "datetime" | "color";
    placeholder?: string;
    options?: { value: string; label: string }[];
    defaultValue?: string;
    required?: boolean;
}

interface AdminCrudPageProps {
    title: string;
    subtitle: string;
    apiPath: string;
    fields: CrudField[];
    listKey: string; // key in response JSON for array
    displayField: string; // which field to show as title in list
    secondaryField?: string; // subtitle in list
}

export function AdminCrudPage({ title, subtitle, apiPath, fields, listKey, displayField, secondaryField }: AdminCrudPageProps) {
    const ct = useTranslations("admin");
    const [items, setItems] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<Record<string, string>>({});
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const { confirm } = useConfirm();

    const resetForm = () => {
        const defaults: Record<string, string> = {};
        fields.forEach((f) => { defaults[f.key] = f.defaultValue || ""; });
        setForm(defaults);
        setEditingId(null);
        setShowForm(false);
    };

    const fetchItems = async () => {
        try {
            const res = await fetch(apiPath);
            if (res.ok) {
                const data = await res.json();
                setItems(data[listKey] || []);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchItems(); resetForm(); }, []);

    const startEdit = (item: Record<string, unknown>) => {
        setEditingId(item.id as string);
        const vals: Record<string, string> = {};
        fields.forEach((f) => {
            const v = item[f.key];
            if (f.type === "datetime" && v) {
                vals[f.key] = new Date(v as string).toISOString().slice(0, 16);
            } else {
                vals[f.key] = v != null ? String(v) : f.defaultValue || "";
            }
        });
        setForm(vals);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const payload: Record<string, unknown> = {};
        fields.forEach((f) => {
            const v = form[f.key];
            if (f.type === "number") payload[f.key] = v ? Number(v) : undefined;
            else if (f.type === "toggle") payload[f.key] = v === "true";
            else if (f.type === "datetime") payload[f.key] = v ? new Date(v).toISOString() : null;
            else payload[f.key] = v || undefined;
        });

        const url = editingId ? `${apiPath}/${editingId}` : apiPath;
        const method = editingId ? "PATCH" : "POST";

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            toast.success(editingId ? "Updated" : "Created");
            resetForm();
            fetchItems();
        } else {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || "Failed");
        }
        setSaving(false);
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) { next.delete(id); } else { next.add(id); }
        setSelected(next);
    };

    const bulkDelete = async () => {
        const ok = await confirm({ title: ct("crud_deleteItems"), message: ct("crud_deleteItemsConfirm", { count: selected.size }), variant: "danger", confirmText: ct("crud_delete") });
        if (!ok) return;
        for (const id of selected) {
            await fetch(`${apiPath}/${id}`, { method: "DELETE" });
        }
        toast.success(ct("crud_deleted"));
        setSelected(new Set());
        fetchItems();
    };

    const deleteItem = async (id: string) => {
        const ok = await confirm({ title: ct("crud_deleteItem"), message: ct("crud_deleteItemConfirm"), variant: "danger", confirmText: ct("crud_delete") });
        if (!ok) return;
        const res = await fetch(`${apiPath}/${id}`, { method: "DELETE" });
        if (res.ok) { toast.success(ct("crud_deleted")); fetchItems(); }
        else toast.error("Failed to delete");
    };

    const renderField = (field: CrudField) => {
        const val = form[field.key] || "";
        const onChange = (v: string) => setForm({ ...form, [field.key]: v });

        switch (field.type) {
            case "textarea":
                return <Textarea value={val} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} required={field.required} rows={3} />;
            case "select":
                return (
                    <select value={val} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required={field.required}>
                        <option value="">Select...</option>
                        {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                );
            case "toggle":
                return (
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={val === "true"} onChange={(e) => onChange(String(e.target.checked))} className="rounded" />
                        <span className="text-sm">Enabled</span>
                    </label>
                );
            case "datetime":
                return <Input type="datetime-local" value={val} onChange={(e) => onChange(e.target.value)} />;
            case "color":
                return (
                    <div className="flex gap-2">
                        <input type="color" value={val || "#3b82f6"} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                        <Input value={val} onChange={(e) => onChange(e.target.value)} placeholder="#3b82f6" />
                    </div>
                );
            default:
                return <Input type={field.type || "text"} value={val} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} required={field.required} />;
        }
    };

    const [page, setPage] = useState(1);
    const perPage = 20;
    const totalPages = Math.ceil(items.length / perPage);
    const paginatedItems = items.slice((page - 1) * perPage, page * perPage);

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{title}</h1>
                    <p className="text-muted-foreground">{subtitle}</p>
                </div>
                <div className="flex gap-2">
                    {selected.size > 0 && (
                        <Button variant="destructive" size="sm" onClick={bulkDelete}>
                            <Trash2 className="w-3 h-3 mr-1" /> {ct("crud_delete")} {selected.size}
                        </Button>
                    )}
                    <Button onClick={() => showForm ? resetForm() : setShowForm(true)}>
                        {showForm ? <><X className="w-4 h-4 mr-2" /> {ct("crud_cancel")}</> : <><Plus className="w-4 h-4 mr-2" /> {ct("crud_addNew")}</>}
                    </Button>
                </div>
            </div>

            {showForm && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{editingId ? ct("crud_edit") : ct("crud_createNew")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                {fields.map((field) => (
                                    <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                                        <Label>{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
                                        {renderField(field)}
                                    </div>
                                ))}
                            </div>
                            <Button type="submit" disabled={saving}>
                                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {ct("crud_saving")}</> : editingId ? ct("crud_saveChanges") : ct("crud_create")}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-0">
                    {items.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{ct("crud_noItems")}</p>
                    ) : (
                        <div className="divide-y">
                            {paginatedItems.map((item) => (
                                <div key={item.id as string} className="flex items-center gap-3 p-4 hover:bg-muted/50">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(item.id as string)}
                                        onChange={() => toggleSelect(item.id as string)}
                                        className="rounded flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium">{String(item[displayField] || "")}</p>
                                        {secondaryField && (
                                            <p className="text-sm text-muted-foreground">{String(item[secondaryField] || "")}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => startEdit(item)}>
                                            <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteItem(item.id as string)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-3 border-t">
                            <span className="text-xs text-muted-foreground">{items.length} items · Page {page}/{totalPages}</span>
                            <div className="flex gap-1">
                                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
                                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
