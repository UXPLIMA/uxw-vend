"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Application {
    id: string;
    position: string;
    content: string;
    status: string;
    adminNote: string | null;
    createdAt: string;
    user: { id: string; username: string; email: string; avatar: string | null };
}

const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    accepted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
};

export default function StaffApplicationsPage() {
    const t = useTranslations("staff");
    const [apps, setApps] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");

    const fetchApps = async () => {
        const res = await fetch("/api/v1/staff-applications");
        if (res.ok) { const data = await res.json(); setApps(data.applications || []); }
        setLoading(false);
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { fetchApps(); }, []);

    const updateStatus = async (id: string, status: string) => {
        const adminNote = status === "rejected" ? prompt("Rejection reason (optional):") : null;
        const res = await fetch(`/api/v1/staff-applications/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, adminNote }),
        });
        if (res.ok) { toast.success(`Application ${status}`); fetchApps(); }
    };

    const filtered = filter ? apps.filter((a) => a.status === filter) : apps;

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{t("adm_staffApplications")}</h1>
                <p className="text-muted-foreground">{t("adm_pendingReview", { count: apps.filter(a => a.status === "pending").length })}</p>
            </div>

            <div className="flex gap-2 mb-6">
                {[
                    { value: "", labelKey: "adm_apps_all" },
                    { value: "pending", labelKey: "adm_apps_pending" },
                    { value: "accepted", labelKey: "adm_apps_accepted" },
                    { value: "rejected", labelKey: "adm_apps_rejected" },
                ].map((s) => (
                    <Button key={s.value} variant={filter === s.value ? "default" : "outline"} size="sm" onClick={() => setFilter(s.value)}>
                        {t(s.labelKey)}
                        {s.value === "pending" && <span className="ml-1 text-xs">({apps.filter(a => a.status === "pending").length})</span>}
                    </Button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">{t("adm_noApplications")}</CardContent></Card>
            ) : (
                <div className="space-y-4">
                    {filtered.map((app) => (
                        <Card key={app.id}>
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {app.user.username[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium">{app.user.username}</p>
                                            <p className="text-xs text-muted-foreground">{app.user.email} · {new Date(app.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-1 rounded ${statusColors[app.status] || ""}`}>{app.status}</span>
                                        <span className="text-sm font-medium text-muted-foreground">{app.position}</span>
                                    </div>
                                </div>

                                <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap mb-3">{app.content}</div>

                                {app.adminNote && (
                                    <p className="text-sm text-muted-foreground mb-3">{t("adm_adminNote")}: {app.adminNote}</p>
                                )}

                                {app.status === "pending" && (
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => updateStatus(app.id, "accepted")} className="bg-green-600 hover:bg-green-700">
                                            <Check className="w-3 h-3 mr-1" /> {t("adm_accept")}
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => updateStatus(app.id, "rejected")}>
                                            <X className="w-3 h-3 mr-1" /> {t("adm_reject")}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </>
    );
}
