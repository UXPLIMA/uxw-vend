"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Plus, X, Trash2, FileText, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface Form {
    id: string;
    title: string;
    slug: string;
    description: string | null;
}

interface FormField {
    name: string;
    type: string;
    label: string;
    required: boolean;
    placeholder?: string;
    options?: string[];
}

export default function FormsPage() {
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);

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

    useEffect(() => { fetchForms(); }, []);

    const addField = () => {
        setFields([...fields, { name: `field_${fields.length}`, type: "text", label: "", required: false }]);
    };

    const updateField = (i: number, updates: Partial<FormField>) => {
        setFields(fields.map((f, idx) => idx === i ? { ...f, ...updates } : f));
    };

    const removeField = (i: number) => {
        setFields(fields.filter((_, idx) => idx !== i));
    };

    const createForm = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const res = await fetch("/api/v1/forms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, description, fields }),
        });
        if (res.ok) {
            toast.success("Form created");
            setShowCreate(false);
            setTitle("");
            setDescription("");
            setFields([{ name: "name", type: "text", label: "Name", required: true }]);
            fetchForms();
        } else toast.error("Failed");
        setSaving(false);
    };

    const deleteForm = async (slug: string) => {
        if (!confirm("Delete this form and all submissions?")) return;
        await fetch(`/api/v1/forms/${slug}`, { method: "DELETE" });
        fetchForms();
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Custom Forms</h1>
                    <p className="text-muted-foreground">Create forms for applications, contact, etc.</p>
                </div>
                <Button onClick={() => setShowCreate(!showCreate)}>
                    {showCreate ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> New Form</>}
                </Button>
            </div>

            {showCreate && (
                <Card className="mb-6">
                    <CardHeader><CardTitle>Create Form</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={createForm} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Form Title *</Label>
                                    <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Contact Form" />
                                </div>
                                <div>
                                    <Label>Description</Label>
                                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label>Fields</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addField}>
                                        <Plus className="w-3 h-3 mr-1" /> Add Field
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {fields.map((field, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                            <Input value={field.label} onChange={(e) => updateField(i, { label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, "_") })} placeholder="Field label" className="flex-1" />
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
                                                Req
                                            </label>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => removeField(i)}><X className="w-3 h-3" /></Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Button type="submit" disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Create Form
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {forms.length === 0 ? (
                    <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">No forms yet</CardContent></Card>
                ) : forms.map((form) => (
                    <Card key={form.id}>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <FileText className="w-5 h-5 text-muted-foreground mb-1" />
                                    <h3 className="font-medium">{form.title}</h3>
                                    {form.description && <p className="text-xs text-muted-foreground">{form.description}</p>}
                                </div>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteForm(form.slug)}><Trash2 className="w-3 h-3" /></Button>
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
