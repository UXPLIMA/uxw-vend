"use client";

import { useState, useEffect, use } from "react";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Textarea } from "@/core/components/ui/textarea";
import { Label } from "@/core/components/ui/label";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface FormField {
    name: string;
    type: string; // text, textarea, select, checkbox, email, number
    label: string;
    required?: boolean;
    placeholder?: string;
    options?: string[]; // for select
}

interface CustomForm {
    id: string;
    title: string;
    description: string | null;
    fields: FormField[];
}

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default function FormPage({ params }: PageProps) {
    const { slug } = use(params);
    const [form, setForm] = useState<CustomForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [values, setValues] = useState<Record<string, string>>({});

    useEffect(() => {
        fetch(`/api/v1/forms/${slug}`)
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then((d) => { setForm(d.form); setLoading(false); })
            .catch(() => setLoading(false));
    }, [slug]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form) return;
        setSubmitting(true);

        const res = await fetch(`/api/v1/forms/${slug}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: values }),
        });

        if (res.ok) {
            setSubmitted(true);
            toast.success("Form submitted successfully!");
        } else {
            toast.error("Failed to submit form");
        }
        setSubmitting(false);
    };

    const renderField = (field: FormField) => {
        const val = values[field.name] || "";
        const onChange = (v: string) => setValues({ ...values, [field.name]: v });

        switch (field.type) {
            case "textarea":
                return <Textarea value={val} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} required={field.required} rows={4} />;
            case "select":
                return (
                    <select value={val} onChange={(e) => onChange(e.target.value)} required={field.required} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Select...</option>
                        {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                );
            case "checkbox":
                return (
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={val === "true"} onChange={(e) => onChange(String(e.target.checked))} className="rounded" />
                        <span className="text-sm">{field.placeholder || field.label}</span>
                    </label>
                );
            default:
                return <Input type={field.type || "text"} value={val} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} required={field.required} />;
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <HeroBanner />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-2xl">
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : !form ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">Form not found</CardContent></Card>
                ) : submitted ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                            <h2 className="text-xl font-bold text-foreground mb-1">Thank you!</h2>
                            <p className="text-muted-foreground">Your response has been submitted.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>{form.title}</CardTitle>
                            {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {form.fields.map((field) => (
                                    <div key={field.name}>
                                        <Label>{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
                                        {renderField(field)}
                                    </div>
                                ))}
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</> : "Submit"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </main>

            <Footer />
        </div>
    );
}
