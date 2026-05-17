"use client";


import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, ChevronDown, ChevronUp, FileText } from "lucide-react";

interface Form {
    id: string;
    title: string;
    slug: string;
}

interface Submission {
    id: string;
    formId: string;
    userId: string | null;
    data: Record<string, unknown>;
    status: string;
    createdAt: string;
    form: Form;
}

export default function SubmissionsPage() {
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const t = useTranslations("customForms");
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterForm, setFilterForm] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchForms = async () => {
        const res = await fetch("/api/v1/forms");
        if (res.ok) {
            const data = await res.json();
            setForms(data.forms || []);
        }
    };

    const fetchSubmissions = async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "50" });
        if (filterForm) params.set("formId", filterForm);

        const res = await fetch(`/api/v1/forms/submissions?${params}`);
        if (res.ok) {
            const data = await res.json();
            setSubmissions(data.submissions || []);
            setTotal(data.total || 0);
            setTotalPages(data.pages || 1);
        }
        setLoading(false);
    };

    useEffect(() => { fetchForms(); }, []);
    useEffect(() => { fetchSubmissions(); }, [filterForm, page]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("adm_formSubmissions")}</h1>
                    <p className="text-muted-foreground">{total} total submission{total !== 1 ? "s" : ""}</p>
                </div>
            </div>

            {/* Filter by form */}
            <div className="flex gap-2 mb-4">
                <select
                    value={filterForm}
                    onChange={(e) => { setFilterForm(e.target.value); setPage(1); }}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                    <option value="">{t("adm_allForms")}</option>
                    {forms.map((f) => (
                        <option key={f.id} value={f.id}>{f.title}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : submissions.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-muted-foreground">{t("adm_noSubmissions")}</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="space-y-2">
                        {submissions.map((sub) => (
                            <Card key={sub.id}>
                                <CardContent className="p-4">
                                    <button
                                        className="w-full flex items-center justify-between text-left"
                                        onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                                    >
                                        <div>
                                            <span className="font-medium text-foreground">{sub.form.title}</span>
                                            <span className="text-xs text-muted-foreground ml-3">
                                                {new Date(sub.createdAt).toLocaleString("tr-TR")}
                                            </span>
                                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${sub.status === "new" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                                                {sub.status}
                                            </span>
                                        </div>
                                        {expandedId === sub.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    {expandedId === sub.id && (
                                        <div className="mt-3 pt-3 border-t border-border">
                                            <table className="w-full text-sm">
                                                <tbody>
                                                    {Object.entries(sub.data).map(([key, value]) => (
                                                        <tr key={key} className="border-b border-border/50 last:border-0">
                                                            <td className="py-1.5 pr-4 font-medium text-muted-foreground capitalize w-1/3">{key.replace(/_/g, " ")}</td>
                                                            <td className="py-1.5 text-foreground">{String(value)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {sub.userId && (
                                                <p className="text-xs text-muted-foreground mt-2">User ID: {sub.userId}</p>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-4">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                Previous
                            </Button>
                            <span className="flex items-center text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </span>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                                Next
                            </Button>
                        </div>
                    )}
                </>
            )}
        </>
    );
}
