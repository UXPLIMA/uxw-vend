"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Plus, X, Trash2, FileText, Link as LinkIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface FormField {
    name: string;
    type: string;
    label: string;
    required: boolean;
    placeholder?: string;
    options?: string[];
}

interface Form {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    fields?: FormField[];
}

export default function FormsPage() {
    const t = useTranslations("customForms");
    const { confirm } = useConfirm();
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingSlug, setEditingSlug] = useState<string | null>(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [fields, setFields] = useState<FormField[]>([
        { name: "name", type: "text", label: "Name", required: true },
    ]);

    const fetchForms = async () => {
        const res = await fetch("/api/v1/forms");
        if (res.ok) { const data = await res.json(); setForms(data.forms || []); }
        setLoading(false);
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { fetchForms(); }, []);

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setFields([{ name: "name", type: "text", label: "Name", required: true }]);
        setEditingSlug(null);
        setShowCreate(false);
    };

    const startEdit = async (form: Form) => {
        try {
            const res = await fetch(`/api/v1/forms/${form.slug}`);
            if (!res.ok) {
                toast.error("Failed to load form");
                return;
            }
            const data = await res.json();
            const f = data.form;
            setEditingSlug(f.slug);
            setTitle(f.title || "");
            setDescription(f.description || "");
            setFields(Array.isArray(f.fields) && f.fields.length > 0 ? f.fields : [{ name: "name", type: "text", label: "Name", required: true }]);
            setShowCreate(true);
        } catch {
            toast.error("Failed to load form");
        }
    };

    const addField = () => {
        setFields([...fields, { name: `field_${fields.length}`, type: "text", label: "", required: false }]);
    };

    const updateField = (i: number, updates: Partial<FormField>) => {
        setFields(fields.map((f, idx) => idx === i ? { ...f, ...updates } : f));
    };

    const removeField = (i: number) => {
        setFields(fields.filter((_, idx) => idx !== i));
    };

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const url = editingSlug ? `/api/v1/forms/${editingSlug}` : "/api/v1/forms";
        const method = editingSlug ? "PATCH" : "POST";
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description, fields }),
        });
        if (res.ok) {
            toast.success(editingSlug ? "Updated" : "Created");
            resetForm();
            fetchForms();
        } else {
            toast.error("Failed");
        }
        setSaving(false);
    };

    const deleteForm = async (slug: string) => {
        const ok = await confirm({
            title: t("adm_deleteForm") || "Delete form",
            message: t("adm_deleteFormConfirm") || "Delete this form and all submissions?",
            variant: "danger",
        });
        if (!ok) return;
        await fetch(`/api/v1/forms/${slug}`, { method: "DELETE" });
        fetchForms();
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("adm_customForms")}</h1>
                    <p className="text-muted-foreground">{t("adm_customFormsSubtitle")}</p>
                </div>
                <Button onClick={() => showCreate ? resetForm() : setShowCreate(true)}>
                    {showCreate ? <><X className="w-4 h-4 mr-2" /> {t("adm_cancel")}</> : <><Plus className="w-4 h-4 mr-2" /> {t("adm_newForm")}</>}
                </Button>
            </div>

            {showCreate && (
                <Card className="mb-6">
                    <CardHeader><CardTitle>{editingSlug ? t("adm_editForm") || "Edit Form" : t("adm_createForm")}</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={submitForm} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>{`${t("adm_formTitle")} *`}</Label>
                                    <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Contact Form" />
                                </div>
                                <div>
                                    <Label>{t("adm_description")}</Label>
                                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label>{t("adm_fields")}</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addField}>
                                        <Plus className="w-3 h-3 mr-1" /> {t("adm_addField")}
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {fields.map((field, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                            <Input value={field.label} onChange={(e) => updateField(i, { label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })} placeholder={t("adm_fieldLabel")} className="flex-1" />
                                            <select value={field.type} onChange={(e) => updateField(i, { type: e.target.value })} className="rounded-md border border-input bg-background px-2 py-1 text-sm">
                                                <option value="text">Text</option>
                                                <option value="email">Email</option>
                                                <option value="number">Number</option>
                                                <option value="textarea">Textarea</option>
                                                <option value="select">Select</option>
                                                <option value="checkbox">Checkbox</option>
                                            </select>
                                            <label className="flex items-center gap-1 text-xs">
                                                <input type="checkbox" checked={field.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                                                {t("adm_required") || "Req"}
                                            </label>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => removeField(i)}><X className="w-3 h-3" /></Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Button type="submit" disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {editingSlug ? t("adm_saveChanges") || "Save Changes" : t("adm_createFormButton") || "Create Form"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {forms.length === 0 ? (
                    <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">{t("adm_noFormsYet")}</CardContent></Card>
                ) : forms.map((form) => (
                    <Card key={form.id}>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                    <FileText className="w-5 h-5 text-muted-foreground mb-1" />
                                    <h3 className="font-medium">{form.title}</h3>
                                    {form.description && <p className="text-xs text-muted-foreground">{form.description}</p>}
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => startEdit(form)}><Pencil className="w-3 h-3" /></Button>
                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteForm(form.slug)}><Trash2 className="w-3 h-3" /></Button>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <LinkIcon className="w-3 h-3" /> /form/{form.slug}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </>
    );
}
