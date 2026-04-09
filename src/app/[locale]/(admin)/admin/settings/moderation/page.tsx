"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { ArrowLeft, Loader2, ShieldAlert, Save } from "lucide-react";
import { toast } from "sonner";

type ModerationMode = "auto" | "manual";

interface ModerationConfig {
    blog_comments: ModerationMode;
    forum_topics: ModerationMode;
    forum_posts: ModerationMode;
    suggestions: ModerationMode;
}

const DEFAULT_CONFIG: ModerationConfig = {
    blog_comments: "auto",
    forum_topics: "auto",
    forum_posts: "auto",
    suggestions: "auto",
};

const FIELDS: { key: keyof ModerationConfig; label: string; description: string }[] = [
    {
        key: "blog_comments",
        label: "Blog comments",
        description: "Require approval before comments on blog articles appear publicly.",
    },
    {
        key: "forum_topics",
        label: "Forum topics",
        description: "Require approval before new forum topics are listed.",
    },
    {
        key: "forum_posts",
        label: "Forum replies",
        description: "Require approval before forum replies appear in a topic.",
    },
    {
        key: "suggestions",
        label: "Suggestions",
        description: "Require approval before user suggestions are listed publicly.",
    },
];

export default function ModerationSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<ModerationConfig>(DEFAULT_CONFIG);

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => (r.ok ? r.json() : null))
            .then((payload: { settings?: Record<string, unknown> } | null) => {
                const stored = payload?.settings?.moderation as Partial<ModerationConfig> | undefined;
                if (stored && typeof stored === "object") {
                    setConfig({
                        blog_comments: stored.blog_comments === "manual" ? "manual" : "auto",
                        forum_topics: stored.forum_topics === "manual" ? "manual" : "auto",
                        forum_posts: stored.forum_posts === "manual" ? "manual" : "auto",
                        suggestions: stored.suggestions === "manual" ? "manual" : "auto",
                    });
                }
            })
            .catch(() => {
                toast.error("Failed to load moderation settings");
            })
            .finally(() => setLoading(false));
    }, []);

    const toggleField = (key: keyof ModerationConfig) => {
        setConfig((prev) => ({
            ...prev,
            [key]: prev[key] === "manual" ? "auto" : "manual",
        }));
    };

    const onSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ moderation: config }),
            });
            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                toast.error(data?.error || "Failed to save");
                return;
            }
            toast.success("Moderation settings saved");
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
                    <ShieldAlert className="w-7 h-7 text-rose-500" />
                    Moderation
                </h1>
                <p className="text-muted-foreground">
                    Choose which user-submitted content types require admin approval before being
                    visible to visitors.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Approval required</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {FIELDS.map((field) => (
                        <label
                            key={field.key}
                            className="flex items-start gap-3 cursor-pointer border rounded-md p-3 hover:bg-accent/40"
                        >
                            <input
                                type="checkbox"
                                checked={config[field.key] === "manual"}
                                onChange={() => toggleField(field.key)}
                                className="w-4 h-4 mt-1"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{field.label}</p>
                                <p className="text-xs text-muted-foreground">{field.description}</p>
                            </div>
                            <span
                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                                    config[field.key] === "manual"
                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                        : "bg-muted text-muted-foreground"
                                }`}
                            >
                                {config[field.key]}
                            </span>
                        </label>
                    ))}
                </CardContent>
            </Card>

            <div className="flex items-center justify-between">
                <Link
                    href="/admin/moderation"
                    className="text-sm text-primary hover:underline"
                >
                    Open moderation queue
                </Link>
                <Button onClick={onSave} disabled={saving}>
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
