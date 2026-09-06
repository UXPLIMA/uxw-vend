"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { writeError } from "@/core/lib/write-result";
import { AdminPageHeader } from "@/core/components/admin/AdminPageHeader";
import { Textarea } from "@/core/components/ui/textarea";
import { LoadFailed } from "@/core/components/ui/load-failed";
import { useSettingsLoad } from "@/core/hooks/useSettingsLoad";

export default function CssSettingsPage() {
    const t = useTranslations("admin");
    const [css, setCss] = useState("");
    const [saving, setSaving] = useState(false);
    // An empty editor over a failed read, with a save button under it, is how
    // a site loses its stylesheet.
    const { loading, failed, retry } = useSettingsLoad((settings) => {
        setCss((settings.custom_css as string) || "");
    });

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ custom_css: css }),
            });
            const writeFailed = await writeError(res, t("common_writeFailed"), t);
            if (writeFailed) { toast.error(writeFailed); return; }
            toast.success(t("css_saved"));
        } catch {
            toast.error(t("common_writeFailed"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <AdminPageHeader
                title={t("css_title")}
                description={t("css_subtitle")}
            />

            {failed ? (
                <Card>
                    <CardContent><LoadFailed onRetry={retry} /></CardContent>
                </Card>
            ) : (
            <>

            <Card className="mb-6">
                <CardHeader><CardTitle>{t("css_editor")}</CardTitle></CardHeader>
                <CardContent>
                    <Textarea
                        value={css}
                        onChange={(e) => setCss(e.target.value)}
                        placeholder={`/* Your custom CSS here */\n.my-class {\n  color: red;\n}`}
                        aria-label={t("css_editor")}
                        rows={20}
                        className="font-mono resize-y"
                        spellCheck={false}
                    />
                </CardContent>
            </Card>

            <Button onClick={save} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("css_saving")}</> : <><Check className="w-4 h-4" /> {t("css_saveCss")}</>}
            </Button>
            </>
            )}
        </>
    );
}
