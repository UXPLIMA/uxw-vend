"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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

const FIELD_KEYS: { key: keyof ModerationConfig; labelKey: string; descKey: string }[] = [
    { key: "blog_comments", labelKey: "moderationSettings_blogComments", descKey: "moderationSettings_blogCommentsDesc" },
    { key: "forum_topics", labelKey: "moderationSettings_forumTopics", descKey: "moderationSettings_forumTopicsDesc" },
    { key: "forum_posts", labelKey: "moderationSettings_forumReplies", descKey: "moderationSettings_forumRepliesDesc" },
    { key: "suggestions", labelKey: "moderationSettings_suggestions", descKey: "moderationSettings_suggestionsDesc" },
];

export default function ModerationSettingsPage() {
    const t = useTranslations("admin");
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
                toast.error(t("moderationSettings_loadFailed"));
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
                toast.error(data?.error || t("moderationSettings_saveFailed"));
                return;
            }
            toast.success(t("moderationSettings_saved"));
        } catch {
            toast.error(t("moderationSettings_saveFailed"));
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
            <div>
                <h1 className="text-3xl font-bold">
                    {t("moderationSettings_title")}
                </h1>
                <p className="text-muted-foreground">
                    {t("moderationSettings_subtitle")}
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t("moderationSettings_approvalRequired")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {FIELD_KEYS.map((field) => (
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
                                <p className="text-sm font-medium text-foreground">{t(field.labelKey)}</p>
                                <p className="text-xs text-muted-foreground">{t(field.descKey)}</p>
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
                    {t("moderationSettings_openQueue")}
                </Link>
                <Button onClick={onSave} disabled={saving}>
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("moderationSettings_saving")}
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" /> {t("moderationSettings_saveChanges")}
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
