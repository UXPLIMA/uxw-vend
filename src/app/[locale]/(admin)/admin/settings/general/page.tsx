"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { ArrowLeft, Loader2, Check, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

interface FieldDef {
    key: string;
    label: string;
    type: "number" | "toggle";
    defaultValue: number | boolean;
    description?: string;
}

interface SectionDef {
    title: string;
    fields: FieldDef[];
}

const sections: SectionDef[] = [
    {
        title: "Pagination & Display",
        fields: [
            { key: "per_page_products", label: "Products per page", type: "number", defaultValue: 12 },
            { key: "per_page_blog", label: "Blog articles per page", type: "number", defaultValue: 10 },
            { key: "per_page_forum", label: "Forum topics per page", type: "number", defaultValue: 20 },
            { key: "per_page_leaderboard", label: "Leaderboard entries", type: "number", defaultValue: 20 },
            { key: "per_page_home_news", label: "Homepage news items", type: "number", defaultValue: 4 },
            { key: "slider_interval", label: "Slider auto-advance (ms)", type: "number", defaultValue: 5000 },
        ],
    },
    {
        title: "Wheel of Fortune",
        fields: [
            { key: "wheel_enabled", label: "Enable Wheel of Fortune", type: "toggle", defaultValue: true },
            { key: "wheel_spin_cooldown_hours", label: "Spin cooldown (hours)", type: "number", defaultValue: 24 },
            { key: "wheel_spin_cost_credits", label: "Spin cost (credits, 0=free)", type: "number", defaultValue: 0 },
            { key: "wheel_max_daily_spins", label: "Max spins per day", type: "number", defaultValue: 1 },
        ],
    },
    {
        title: "Voting System",
        fields: [
            { key: "vote_enabled", label: "Enable Vote Rewards", type: "toggle", defaultValue: true },
            { key: "vote_cooldown_hours", label: "Vote cooldown (hours)", type: "number", defaultValue: 24 },
            { key: "vote_reward_multiplier", label: "Reward multiplier", type: "number", defaultValue: 1 },
        ],
    },
    {
        title: "Order & Ticket Automation",
        fields: [
            { key: "order_auto_cancel_hours", label: "Auto-cancel pending orders after (hours)", type: "number", defaultValue: 24 },
            { key: "ticket_auto_close_days", label: "Auto-close resolved tickets after (days)", type: "number", defaultValue: 7 },
        ],
    },
    {
        title: "Creator Codes",
        fields: [
            { key: "creator_default_discount", label: "Default creator discount (%)", type: "number", defaultValue: 5 },
            { key: "creator_default_commission", label: "Default creator commission (%)", type: "number", defaultValue: 5 },
        ],
    },
    {
        title: "Authentication & Security",
        fields: [
            { key: "password_min_length", label: "Minimum password length", type: "number", defaultValue: 6 },
            { key: "email_verify_expiry_hours", label: "Email verification link expiry (hours)", type: "number", defaultValue: 24 },
            { key: "password_reset_expiry_minutes", label: "Password reset link expiry (minutes)", type: "number", defaultValue: 60 },
            { key: "backup_codes_count", label: "2FA backup codes count", type: "number", defaultValue: 8 },
        ],
    },
    {
        title: "Cache & Performance",
        fields: [
            { key: "settings_cache_seconds", label: "Settings cache TTL (seconds)", type: "number", defaultValue: 60 },
            { key: "server_query_cache_seconds", label: "Server query cache (seconds)", type: "number", defaultValue: 60 },
            { key: "widget_refresh_seconds", label: "Widget data refresh (seconds)", type: "number", defaultValue: 30 },
        ],
    },
];

const allFields = sections.flatMap((s) => s.fields);

function getDefault(field: FieldDef): string | boolean {
    if (field.type === "toggle") return field.defaultValue as boolean;
    return String(field.defaultValue);
}

export default function GeneralSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [values, setValues] = useState<Record<string, string | boolean>>({});

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const s = data.settings || {};
                const v: Record<string, string | boolean> = {};
                for (const field of allFields) {
                    if (field.type === "toggle") {
                        const stored = s[field.key];
                        v[field.key] = stored === undefined || stored === null
                            ? (field.defaultValue as boolean)
                            : stored === true || stored === "true";
                    } else {
                        v[field.key] = s[field.key] !== undefined && s[field.key] !== null
                            ? String(s[field.key])
                            : String(field.defaultValue);
                    }
                }
                setValues(v);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const setValue = (key: string, val: string | boolean) => {
        setValues((prev) => ({ ...prev, [key]: val }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });

            if (!res.ok) {
                toast.error("Failed to save settings");
                return;
            }

            toast.success("Settings saved successfully");
        } catch {
            toast.error("Something went wrong");
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

    return (
        <>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/settings">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">General Settings</h1>
                    <p className="text-muted-foreground">Pagination, limits, business rules, and automation settings</p>
                </div>
            </div>

            <form onSubmit={handleSave}>
                <div className="grid lg:grid-cols-2 gap-6">
                    {sections.map((section) => (
                        <Card key={section.title}>
                            <CardHeader>
                                <CardTitle>{section.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {section.fields.map((field) => (
                                    <div key={field.key}>
                                        {field.type === "toggle" ? (
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <Label>{field.label}</Label>
                                                    {field.description && (
                                                        <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant={values[field.key] ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setValue(field.key, !values[field.key])}
                                                >
                                                    {values[field.key] ? (
                                                        <><ToggleRight className="w-4 h-4 mr-1" /> Enabled</>
                                                    ) : (
                                                        <><ToggleLeft className="w-4 h-4 mr-1" /> Disabled</>
                                                    )}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div>
                                                <Label>{field.label}</Label>
                                                <Input
                                                    type="number"
                                                    value={values[field.key] as string}
                                                    onChange={(e) => setValue(field.key, e.target.value)}
                                                    placeholder={String(field.defaultValue)}
                                                    min={0}
                                                />
                                                {field.description && (
                                                    <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="mt-6">
                    <Button type="submit" disabled={saving}>
                        {saving ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                        ) : (
                            <><Check className="w-4 h-4 mr-2" /> Save Settings</>
                        )}
                    </Button>
                </div>
            </form>
        </>
    );
}
