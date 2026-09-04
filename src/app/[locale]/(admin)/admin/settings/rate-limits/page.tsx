"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Check, Infinity as InfinityIcon } from "lucide-react";
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
                toast.error(t("rateLimits_loadError"));
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
                toast.error(j.error || (t("rateLimits_saveError")));
                return;
            }
            toast.success(t("rateLimits_saved"));
        } catch {
            toast.error(t("rateLimits_saveError"));
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

    const titleText = t("rateLimits_title");
    const subtitleText = t("rateLimits_subtitle");
    const descriptionText = t("rateLimits_description");
    const roleLabel = t("rateLimits_role");
    const multiplierLabel = t("rateLimits_multiplier");
    const unlimitedLabel = t("rateLimits_unlimited");
    const priorityLabel = t("rateLimits_priority");
    const savingLabel = t("rateLimits_saving");
    const saveLabel = t("rateLimits_save");

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{titleText}</h1>
                <p className="text-muted-foreground">{subtitleText}</p>
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
                                {t("rateLimits_noRoles")}
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
