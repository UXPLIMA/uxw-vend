"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { ArrowLeft, Loader2, Wrench, Save } from "lucide-react";
import { toast } from "sonner";

interface MaintenanceConfig {
    enabled: boolean;
    message?: string;
    allowedRoles?: string[];
}

const ROLE_OPTIONS = ["admin", "moderator", "member"];

export default function MaintenanceSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const [message, setMessage] = useState("");
    const [allowedRoles, setAllowedRoles] = useState<string[]>(["admin"]);

    useEffect(() => {
        fetch("/api/v1/admin/maintenance")
            .then((r) => (r.ok ? r.json() : null))
            .then((payload: { data?: MaintenanceConfig } | null) => {
                const cfg = payload?.data;
                if (cfg) {
                    setEnabled(Boolean(cfg.enabled));
                    setMessage(cfg.message || "");
                    setAllowedRoles(
                        cfg.allowedRoles && cfg.allowedRoles.length > 0
                            ? cfg.allowedRoles
                            : ["admin"]
                    );
                }
            })
            .catch(() => {
                toast.error("Failed to load maintenance settings");
            })
            .finally(() => setLoading(false));
    }, []);

    const toggleRole = (role: string) => {
        setAllowedRoles((prev) =>
            prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
        );
    };

    const onSave = async () => {
        if (!allowedRoles.includes("admin")) {
            toast.error("Admin role must always be allowed during maintenance.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/v1/admin/maintenance", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ enabled, message, allowedRoles }),
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                toast.error(data?.error || "Failed to save");
                return;
            }
            toast.success("Maintenance settings saved");
        } catch {
            toast.error("Failed to save");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link
                    href="/admin/settings"
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to settings
                </Link>
            </div>

            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Wrench className="w-7 h-7 text-amber-600" />
                    Maintenance Mode
                </h1>
                <p className="text-muted-foreground">
                    Temporarily take your site offline for visitors while allowing administrators to
                    continue browsing.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setEnabled(e.target.checked)}
                            className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-foreground">
                            Enable maintenance mode
                        </span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                        When enabled, visitors whose role is not in the allowed list will see the
                        maintenance page. Authentication endpoints remain accessible so admins can
                        still sign in.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Message</CardTitle>
                </CardHeader>
                <CardContent>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        placeholder="We'll be back soon."
                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        Shown to visitors on the maintenance page.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Allowed roles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">
                        Users with these roles can still browse the site while maintenance mode is
                        active.
                    </p>
                    {ROLE_OPTIONS.map((role) => (
                        <label
                            key={role}
                            className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                checked={allowedRoles.includes(role)}
                                onChange={() => toggleRole(role)}
                                disabled={role === "admin"}
                            />
                            <span className="capitalize">{role}</span>
                            {role === "admin" && (
                                <span className="text-xs text-muted-foreground">(always allowed)</span>
                            )}
                        </label>
                    ))}
                    <Input
                        type="text"
                        placeholder="Add custom role name and press Enter"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                const target = e.target as HTMLInputElement;
                                const v = target.value.trim().toLowerCase();
                                if (v && !allowedRoles.includes(v)) {
                                    setAllowedRoles([...allowedRoles, v]);
                                }
                                target.value = "";
                            }
                        }}
                        className="mt-2"
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button
                    onClick={onSave}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" /> Save changes
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
