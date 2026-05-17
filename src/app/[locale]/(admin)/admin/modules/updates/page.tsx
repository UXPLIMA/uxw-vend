"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { ArrowLeft, Loader2, Download, Check, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface UpdateInfo {
    moduleId: string;
    name: string;
    installedVersion: string;
    latestVersion: string;
    description?: string;
}

export default function ModuleUpdatesPage() {
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const t = useTranslations("admin");
    const [updates, setUpdates] = useState<UpdateInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState<Set<string>>(new Set());
    const [updated, setUpdated] = useState<Set<string>>(new Set());
    const [checkedAt, setCheckedAt] = useState<string | null>(null);

    const fetchUpdates = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/v1/modules/updates");
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || (t.has("moduleUpdates_checkFailed") ? t("moduleUpdates_checkFailed") : "Failed to check"));
                return;
            }
            setUpdates(data.updates || []);
            setCheckedAt(data.checkedAt || null);
        } catch {
            setError(t.has("moduleUpdates_networkError") ? t("moduleUpdates_networkError") : "Network error");
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

    const updateModule = async (moduleId: string) => {
        setUpdating((s) => new Set(s).add(moduleId));
        try {
            const res = await fetch("/api/v1/modules/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ moduleId }),
            });
            if (res.ok) {
                toast.success(
                    t.has("moduleUpdates_updatedToast")
                        ? t("moduleUpdates_updatedToast", { name: moduleId })
                        : `${moduleId} updated`,
                );
                setUpdated((s) => new Set(s).add(moduleId));
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || (t.has("moduleUpdates_updateFailed") ? t("moduleUpdates_updateFailed") : "Update failed"));
            }
        } catch {
            toast.error(t.has("moduleUpdates_networkError") ? t("moduleUpdates_networkError") : "Network error");
        } finally {
            setUpdating((s) => {
                const next = new Set(s);
                next.delete(moduleId);
                return next;
            });
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <>
            <div className="flex items-center gap-4 mb-6">
                <Link href="/admin/modules"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold">
                        {t.has("moduleUpdates_title") ? t("moduleUpdates_title") : "Module Updates"}
                    </h1>
                    <p className="text-muted-foreground">
                        {updates.length === 0
                            ? (t.has("moduleUpdates_allUpToDate") ? t("moduleUpdates_allUpToDate") : "All installed modules are up to date")
                            : (t.has("moduleUpdates_count")
                                ? t("moduleUpdates_count", { count: updates.length })
                                : `${updates.length} update${updates.length === 1 ? "" : "s"} available`)}
                        {checkedAt && (
                            <span className="ml-2 text-xs">
                                · {t.has("moduleUpdates_checkedAt") ? t("moduleUpdates_checkedAt", { date: new Date(checkedAt).toLocaleString(__dateTag) }) : `checked ${new Date(checkedAt).toLocaleString(__dateTag)}`}
                            </span>
                        )}
                    </p>
                </div>
                <Button variant="outline" onClick={fetchUpdates}>
                    <RefreshCw className="w-4 h-4 mr-2" /> {t.has("moduleUpdates_recheck") ? t("moduleUpdates_recheck") : "Re-check"}
                </Button>
            </div>

            {error && (
                <Card className="mb-4 border-destructive">
                    <CardContent className="py-3 flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </CardContent>
                </Card>
            )}

            {updates.length === 0 && !error ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <p className="text-muted-foreground">{t.has("moduleUpdates_allUpToDate") ? t("moduleUpdates_allUpToDate") : "All modules are up to date."}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {updates.map((u) => {
                        const isUpdating = updating.has(u.moduleId);
                        const isDone = updated.has(u.moduleId);
                        return (
                            <Card key={u.moduleId}>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center justify-between text-base">
                                        <span>{u.name}</span>
                                        <code className="text-xs font-mono text-muted-foreground">{u.moduleId}</code>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 text-sm mb-2">
                                                <span className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{u.installedVersion}</span>
                                                <span className="text-muted-foreground">→</span>
                                                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 rounded text-xs font-mono font-bold">{u.latestVersion}</span>
                                            </div>
                                            {u.description && (
                                                <p className="text-xs text-muted-foreground">{u.description}</p>
                                            )}
                                        </div>
                                        <Button
                                            onClick={() => updateModule(u.moduleId)}
                                            disabled={isUpdating || isDone}
                                            size="sm"
                                        >
                                            {isUpdating ? (
                                                <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> {t.has("moduleUpdates_updating") ? t("moduleUpdates_updating") : "Updating…"}</>
                                            ) : isDone ? (
                                                <><Check className="w-3 h-3 mr-2" /> {t.has("moduleUpdates_done") ? t("moduleUpdates_done") : "Done"}</>
                                            ) : (
                                                <><Download className="w-3 h-3 mr-2" /> {t.has("moduleUpdates_update") ? t("moduleUpdates_update") : "Update"}</>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </>
    );
}
