"use client";

import { useEffect, useState } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { ArrowLeft, Loader2, Check, Infinity as InfinityIcon, Gauge } from "lucide-react";
import { toast } from "sonner";

interface RoleRow {
    id: string;
    name: string;
    displayName: string;
    priority: number;
}

interface ApiResponse {
    roles: RoleRow[];
    multipliers: Record<string, number>;
}

export default function RateLimitsSettingsPage() {
    const t = useTranslations("admin");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [values, setValues] = useState<Record<string, number>>({});

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/admin/rate-limits")
            .then((r) => r.json())
            .then((data: ApiResponse) => {
                if (cancelled) return;
                setRoles(data.roles || []);
                const clean: Record<string, number> = {};
                for (const [k, v] of Object.entries(data.multipliers || {})) {
                    clean[k] = typeof v === "number" ? v : Number(v) || 1;
                }
                setValues(clean);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                toast.error(t.has("rateLimits_loadError") ? t("rateLimits_loadError") : "Failed to load rate limits");
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [t]);

    const setValue = (roleName: string, raw: number) => {
        const clamped = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 1));
        setValues((prev) => ({ ...prev, [roleName]: clamped }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/v1/admin/rate-limits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ multipliers: values }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                toast.error(j.error || (t.has("rateLimits_saveError") ? t("rateLimits_saveError") : "Failed to save rate limits"));
                return;
            }
            toast.success(t.has("rateLimits_saved") ? t("rateLimits_saved") : "Rate limits saved");
        } catch {
            toast.error(t.has("rateLimits_saveError") ? t("rateLimits_saveError") : "Failed to save rate limits");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const titleText = t.has("rateLimits_title") ? t("rateLimits_title") : "API Rate Limits";
    const subtitleText = t.has("rateLimits_subtitle")
        ? t("rateLimits_subtitle")
        : "Configure per-role multipliers for the API rate limiter.";
    const descriptionText = t.has("rateLimits_description")
        ? t("rateLimits_description")
        : "Each value multiplies the base request limit for that role. Use 0 to disable rate limiting entirely, 1 for the default, or any value up to 100 to raise the ceiling. Changes take effect within 60 seconds.";
    const roleLabel = t.has("rateLimits_role") ? t("rateLimits_role") : "Role";
    const multiplierLabel = t.has("rateLimits_multiplier") ? t("rateLimits_multiplier") : "Multiplier";
    const unlimitedLabel = t.has("rateLimits_unlimited") ? t("rateLimits_unlimited") : "Unlimited";
    const priorityLabel = t.has("rateLimits_priority") ? t("rateLimits_priority") : "Priority";
    const savingLabel = t.has("rateLimits_saving") ? t("rateLimits_saving") : "Saving...";
    const saveLabel = t.has("rateLimits_save") ? t("rateLimits_save") : "Save";

    return (
        <>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/settings">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Gauge className="w-7 h-7 text-indigo-500" />
                        {titleText}
                    </h1>
                    <p className="text-muted-foreground">{subtitleText}</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
                <Card>
                    <CardHeader>
                        <CardTitle>{titleText}</CardTitle>
                        <CardDescription>{descriptionText}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {roles.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                {t.has("rateLimits_noRoles") ? t("rateLimits_noRoles") : "No roles found."}
                            </p>
                        )}
                        {roles.map((role) => {
                            const current = values[role.name] ?? 1;
                            const isUnlimited = current === 0;
                            return (
                                <div
                                    key={role.id}
                                    className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center border rounded-md p-4"
                                >
                                    <div className="space-y-1">
                                        <Label className="text-sm font-semibold flex items-center gap-2">
                                            {role.displayName || role.name}
                                            <span className="text-xs font-normal text-muted-foreground">
                                                ({roleLabel}: {role.name}, {priorityLabel}: {role.priority})
                                            </span>
                                        </Label>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={current}
                                            onChange={(e) => setValue(role.name, Number(e.target.value))}
                                            className="w-full accent-indigo-500"
                                            aria-label={`${role.displayName} ${multiplierLabel}`}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 md:w-40">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={current}
                                            onChange={(e) => setValue(role.name, Number(e.target.value))}
                                            className="w-24"
                                            aria-label={`${role.displayName} ${multiplierLabel} input`}
                                        />
                                        {isUnlimited ? (
                                            <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                                                <InfinityIcon className="w-3 h-3" /> {unlimitedLabel}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">×</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <div>
                    <Button type="submit" disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" /> {savingLabel}
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4 mr-2" /> {saveLabel}
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </>
    );
}
