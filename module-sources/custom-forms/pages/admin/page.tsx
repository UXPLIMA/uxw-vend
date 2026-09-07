"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { Button, Card, CardContent, Input, Label, useConfirm, useFormRoute, NativeSelect, CheckboxField, buttonClassName } from "@/core/sdk/ui";
import { Link } from "@/core/sdk/navigation";
import { ArrowLeft, Loader2, Plus, X, Trash2, FileText, Link as LinkIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { writeError } from "@/core/sdk";
import { AdminPageHeader } from "@/core/sdk/admin";

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
    const commonT = useTranslations("common");
    const { confirm } = useConfirm();
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // The builder is a screen at `?form=new` or `?form=<slug>`, not a card
    // above the list of forms.
    const { showForm: showCreate, editingId: editingSlug, formHref, openForm, closeForm } = useFormRoute();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [fields, setFields] = useState<FormField[]>([
        { name: "name", type: "text", label: "Name", required: true },
    ]);

    const fetchForms = useCallback(async () => {
        const res = await fetch("/api/v1/forms");
        if (res.ok) { const data = await res.json(); setForms(data.forms || []); }
        setLoading(false);
    }, []);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { fetchForms(); }, [fetchForms]);

    // The builder loads the form the URL names, so `?form=<slug>` can be
    // reloaded, linked or reopened and still land on the same fields. The
    // field list is not in the index response, hence the second request.
    useEffect(() => {
        if (!editingSlug) {
            setTitle("");
            setDescription("");
            setFields([{ name: "name", type: "text", label: "Name", required: true }]);
            return;
        }
        let cancelled = false;
        fetch(`/api/v1/forms/${editingSlug}`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load"))))
            .then((data) => {
                if (cancelled) return;
                const f = data.form;
                setTitle(f.title || "");
                setDescription(f.description || "");
                setFields(Array.isArray(f.fields) && f.fields.length > 0 ? f.fields : [{ name: "name", type: "text", label: "Name", required: true }]);
            })
            .catch(() => { if (!cancelled) toast.error(t("adm_loadFormFailed")); });
        return () => { cancelled = true; };
    }, [editingSlug, t]);

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
        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description, fields }),
            });
            if (res.ok) {
                toast.success(editingSlug ? t("adm_formSaved") : t("adm_formCreated"));
                await fetchForms();
                closeForm();
            } else {
                toast.error(t("adm_writeFailed"));
            }
        } catch {
            toast.error(t("adm_writeFailed"));
        } finally {
            setSaving(false);
        }
    };

    const deleteForm = async (slug: string) => {
        const ok = await confirm({
            title: t("adm_deleteForm"),
            message: t("adm_deleteFormConfirm"),
            variant: "danger",
        });
        if (!ok) return;
        const res = await fetch(`/api/v1/forms/${slug}`, { method: "DELETE" });
        const failed = await writeError(res, t("adm_writeFailed"), t);
        if (failed) { toast.error(failed); return; }
        fetchForms();
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    if (showCreate) {
        return (
            <>
                <AdminPageHeader
                    title={editingSlug ? t("adm_editForm") : t("adm_createForm")}
                    description={t("adm_customFormsSubtitle")}
                    onBack={closeForm}
                    backLabel={commonT("back")}
                />

                <Card>
                    <CardContent className="p-6">
                        <form onSubmit={submitForm} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>{`${t("adm_formTitle")} *`}</Label>
                                    <Input aria-label={t("adm_formTitle")} value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={t("adm_titlePlaceholder")} />
                                </div>
                                <div>
                                    <Label>{t("adm_description")}</Label>
                                    <Input aria-label={t("adm_description")} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("adm_descriptionPlaceholder")} />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label>{t("adm_fields")}</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addField}>
                                        <Plus className="w-3 h-3" /> {t("adm_addField")}
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {fields.map((field, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                            <Input value={field.label} onChange={(e) => updateField(i, { label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })} placeholder={t("adm_fieldLabel")} aria-label={t("adm_fieldLabel")} className="flex-1" />
                                            <NativeSelect value={field.type} onChange={(e) => updateField(i, { type: e.target.value })} aria-label={t("fieldType")} inputSize="sm">
                                                <option value="text">{t("typeText")}</option>
                                                <option value="email">{t("typeEmail")}</option>
                                                <option value="number">{t("typeNumber")}</option>
                                                <option value="textarea">{t("typeTextarea")}</option>
                                                <option value="select">{t("typeSelect")}</option>
                                                <option value="checkbox">{t("typeCheckbox")}</option>
                                            </NativeSelect>
                                            <CheckboxField
                                                checked={field.required}
                                                onChange={(e) => updateField(i, { required: e.target.checked })}
                                                label={t("adm_required")}
                                                rowClassName="text-xs whitespace-nowrap"
                                            />
                                            <Button aria-label={commonT("remove")} type="button" variant="ghost" size="sm" onClick={() => removeField(i)}><X className="w-3 h-3" /></Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button type="submit" disabled={saving}>
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    {editingSlug ? t("adm_saveChanges") : t("adm_createFormButton")}
                                </Button>
                                <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>
                                    {t("adm_cancel")}
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
                title={t("adm_customForms")}
                description={t("adm_customFormsSubtitle")}
                actions={<>
                    <Link href={formHref()} className={buttonClassName("default", "default")}><Plus className="w-4 h-4" /> {t("adm_newForm")}</Link>
                </>}
            />

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {forms.length === 0 ? (
                    <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">{t("adm_noFormsYet")}</CardContent></Card>
                ) : forms.map((form) => (
                    <Card key={form.id}>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                    <FileText className="w-5 h-5 text-muted-foreground mb-1" />
                                    <h2 className="font-medium">{form.title}</h2>
                                    {form.description && <p className="text-xs text-muted-foreground">{form.description}</p>}
                                </div>
                                <div className="flex gap-1">
                                    <Button aria-label={commonT("edit")} variant="ghost" size="sm" onClick={() => openForm(form.slug)}><Pencil className="w-3 h-3" /></Button>
                                    <Button aria-label={commonT("delete")} variant="ghost" size="sm" className="text-destructive" onClick={() => deleteForm(form.slug)}><Trash2 className="w-3 h-3" /></Button>
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
