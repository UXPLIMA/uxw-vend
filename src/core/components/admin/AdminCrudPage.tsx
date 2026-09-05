"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { AdminPageHeader } from "@/core/components/admin/AdminPageHeader";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";
import { FileUpload } from "@/core/components/ui/file-upload";
import { UrlOrFile } from "@/core/components/ui/url-or-file";
import { RichTextEditor } from "@/core/components/ui/rich-text-editor";
import { IconPicker } from "@/core/components/ui/icon-picker";
import { writeError } from "@/core/lib/write-result";
import { NativeSelect } from "@/core/components/ui/native-select";
import { Pagination, usePagedRows } from "@/core/components/ui/pagination";
import { Link } from "@/core/lib/i18n/navigation";
import { useFormRoute } from "@/core/hooks/useFormRoute";
import { Checkbox, CheckboxField } from "@/core/components/ui/checkbox";

export interface CrudField {
    key: string;
    label: string;
    /**
     * "password" renders a masked <input type="password">. It hides the value
     * from someone looking over the admin's shoulder; it is not storage
     * advice, and a field holding a real secret still has to be encrypted on
     * the way into the database.
     */
    /** "icon" renders the Lucide icon picker and stores the icon's kebab-case name. */
    type?: "text" | "password" | "number" | "url" | "select" | "textarea" | "toggle" | "datetime" | "color" | "image" | "urlOrFile" | "richtext" | "icon";
    placeholder?: string;
    options?: { value: string; label: string }[];
    defaultValue?: string;
    required?: boolean;
    accept?: string;
}

interface AdminCrudPageProps {
    title: string;
    subtitle: string;
    apiPath: string;
    fields: CrudField[];
    listKey: string; // key in response JSON for array
    displayField: string; // which field to show as title in list
    secondaryField?: string; // subtitle in list
    secondaryRender?: (item: Record<string, unknown>) => string; // overrides secondaryField when provided
}

/**
 * A create or edit screen is a place, and a place has an address.
 *
 * This used to unfold a card above the list. On a screen with two hundred rows
 * that pushes the row you came to edit off the bottom, the browser's back
 * button does nothing, and a half-filled form cannot be linked to or reloaded.
 *
 * The form is now a screen of its own, reached at `?form=new` or
 * `?form=<id>`, replacing the list rather than sitting on top of it. It is a
 * query parameter rather than a `/new` path segment because the field
 * definitions live in the module's own page file - thirteen modules render
 * this component - and a child route would need those definitions copied into
 * two more files per module. The address changes, the back button works and
 * the form owns the screen, which is what the path segment was for.
 */
export function AdminCrudPage({ title, subtitle, apiPath, fields, listKey, displayField, secondaryField, secondaryRender }: AdminCrudPageProps) {
    const ct = useTranslations("admin");
    const commonT = useTranslations("common");
    const [items, setItems] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<Record<string, string>>({});
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const { confirm } = useConfirm();

    // `?form=new` creates, `?form=<id>` edits, absent shows the list.
    const { showForm, editingId, formHref, openForm, closeForm } = useFormRoute();

    const fetchItems = useCallback(async () => {
        try {
            const res = await fetch(apiPath);
            if (res.ok) {
                const data = await res.json();
                setItems(data[listKey] || []);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [apiPath, listKey]);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    // The form is filled from the row the URL names, once the rows arrive -
    // which is also what makes a reload of `?form=<id>` land on a filled form
    // rather than an empty one.
    useEffect(() => {
        const defaults: Record<string, string> = {};
        fields.forEach((f) => { defaults[f.key] = f.defaultValue || ""; });
        if (!editingId) {
            setForm(defaults);
            return;
        }
        const item = items.find((row) => row.id === editingId);
        if (!item) return;
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
        // `fields` is a literal rebuilt on every render by every caller, so it
        // cannot be a dependency without looping.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingId, items]);

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

        const failed = await writeError(res, commonT("somethingWentWrong"), ct);
        if (failed) {
            toast.error(failed);
        } else {
            toast.success(ct(editingId ? "crud_updated" : "crud_created"));
            await fetchItems();
            closeForm();
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
        // One request per row, and every answer used to be thrown away: five
        // rows selected, four refused, and the panel still said "Deleted".
        let deleted = 0;
        for (const id of selected) {
            const res = await fetch(`${apiPath}/${id}`, { method: "DELETE" });
            if (!(await writeError(res, ct("crud_deleteFailed"), ct))) deleted++;
        }
        const total = selected.size;
        setSelected(new Set());
        fetchItems();
        if (deleted === total) toast.success(ct("crud_deleted"));
        else if (deleted === 0) toast.error(ct("crud_deleteFailed"));
        else toast.error(ct("crud_deletedPartly", { deleted, total }));
    };

    const deleteItem = async (id: string) => {
        const ok = await confirm({ title: ct("crud_deleteItem"), message: ct("crud_deleteItemConfirm"), variant: "danger", confirmText: ct("crud_delete") });
        if (!ok) return;
        const res = await fetch(`${apiPath}/${id}`, { method: "DELETE" });
        if (res.ok) { toast.success(ct("crud_deleted")); fetchItems(); }
        else toast.error(ct("crud_deleteFailed"));
    };

    const renderField = (field: CrudField) => {
        const val = form[field.key] || "";
        const onChange = (v: string) => setForm({ ...form, [field.key]: v });

        switch (field.type) {
            case "textarea":
                return <Textarea value={val} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} aria-label={field.label} required={field.required} rows={3} />;
            case "select":
                return (
                    <NativeSelect value={val} onChange={(e) => onChange(e.target.value)} aria-label={field.label} className="w-full" required={field.required}>
                        <option value="">{ct("crud_selectPlaceholder")}</option>
                        {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </NativeSelect>
                );
            case "toggle":
                return (
                    <CheckboxField
                        checked={val === "true"}
                        onChange={(e) => onChange(String(e.target.checked))}
                        label={ct("enabled")}
                    />
                );
            case "datetime":
                return <Input type="datetime-local" value={val} onChange={(e) => onChange(e.target.value)} aria-label={field.label} />;
            case "color":
                return (
                    <div className="flex gap-2">
                        <input type="color" value={val || "#3b82f6"} onChange={(e) => onChange(e.target.value)} aria-label={field.label} className="w-10 h-10 rounded cursor-pointer" />
                        <Input value={val} onChange={(e) => onChange(e.target.value)} placeholder="#3b82f6" aria-label={field.label} />
                    </div>
                );
            case "image":
                return <FileUpload value={val || null} onChange={(v) => onChange(v || "")} accept={field.accept || "image/*"} />;
            case "urlOrFile":
                return <UrlOrFile value={val} onChange={onChange} accept={field.accept} placeholder={field.placeholder} />;
            case "richtext":
                return <RichTextEditor value={val} onChange={onChange} placeholder={field.placeholder} />;
            case "icon":
                return <IconPicker value={val} onChange={onChange} placeholder={field.placeholder} />;
            default:
                return <Input type={field.type || "text"} value={val} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} aria-label={field.label} required={field.required} />;
        }
    };

    const paged = usePagedRows(items);

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    if (showForm) {
        return (
            <>
                <AdminPageHeader
                    onBack={closeForm}
                    backLabel={commonT("back")}
                    title={editingId ? ct("crud_edit") : ct("crud_createNew")}
                    description={title}
                />

                <Card>
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                {fields.map((field) => {
                                    const fullWidth = field.type === "textarea" || field.type === "richtext" || field.type === "urlOrFile" || field.type === "image";
                                    return (
                                        <div key={field.key} className={fullWidth ? "md:col-span-2" : ""}>
                                            <Label>{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
                                            {renderField(field)}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" disabled={saving}>
                                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {ct("crud_saving")}</> : editingId ? ct("crud_saveChanges") : ct("crud_create")}
                                </Button>
                                <Button type="button" variant="outline" disabled={saving} onClick={closeForm}>
                                    {commonT("cancel")}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </>
        );
    }

    return (
        <>
            <AdminPageHeader
                title={title}
                description={subtitle}
                actions={<>
                    {selected.size > 0 && (
                        <Button variant="destructive" onClick={bulkDelete}>
                            <Trash2 className="w-4 h-4" /> {ct("crud_delete")} {selected.size}
                        </Button>
                    )}
                    <Link href={formHref()} className="inline-flex">
                        <Button>
                            <Plus className="w-4 h-4" /> {ct("crud_addNew")}
                        </Button>
                    </Link>
                </>}
            />

            <Card>
                <CardContent className="p-0">
                    {items.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{ct("crud_noItems")}</p>
                    ) : (
                        <div className="divide-y">
                            {paged.rows.map((item) => (
                                <div key={item.id as string} className="flex items-center gap-3 p-4 hover:bg-muted/50">
                                    <Checkbox
                                        checked={selected.has(item.id as string)}
                                        onChange={() => toggleSelect(item.id as string)}
                                        aria-label={ct("common_selectRow")}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium">{String(item[displayField] || "")}</p>
                                        {secondaryRender ? (
                                            <p className="text-sm text-muted-foreground">{secondaryRender(item)}</p>
                                        ) : secondaryField ? (
                                            <p className="text-sm text-muted-foreground">{String(item[secondaryField] || "")}</p>
                                        ) : null}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            aria-label={commonT("edit")}
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openForm(item.id as string)}
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button aria-label={commonT("delete")} variant="ghost" size="sm" className="text-destructive" onClick={() => deleteItem(item.id as string)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <Pagination
                        page={paged.page}
                        pages={paged.pages}
                        total={paged.total}
                        onPageChange={paged.setPage}
                    />
                </CardContent>
            </Card>
        </>
    );
}
