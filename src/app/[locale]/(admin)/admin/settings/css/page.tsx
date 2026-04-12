"use client";

import { useState, useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function CssSettingsPage() {
    const t = useTranslations("admin");
    const [css, setCss] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                setCss((data.settings?.custom_css as string) || "");
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        await fetch("/api/v1/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ custom_css: css }),
        });
        toast.success(t("css_saved"));
        setSaving(false);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{t("css_title")}</h1>
                <p className="text-muted-foreground">{t("css_subtitle")}</p>
            </div>

            <Card className="mb-6">
                <CardHeader><CardTitle>{t("css_editor")}</CardTitle></CardHeader>
                <CardContent>
                    <textarea
                        value={css}
                        onChange={(e) => setCss(e.target.value)}
                        placeholder={`/* Your custom CSS here */\n.my-class {\n  color: red;\n}`}
                        rows={20}
                        className="w-full font-mono text-sm bg-gray-900 text-green-400 p-4 rounded-lg border-0 resize-y"
                        spellCheck={false}
                    />
                </CardContent>
            </Card>

            <Button onClick={save} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("css_saving")}</> : <><Check className="w-4 h-4 mr-2" /> {t("css_saveCss")}</>}
            </Button>
        </>
    );
}
