"use client";

import { useState, useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export default function CssSettingsPage() {
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
        toast.success("Custom CSS saved. Refresh the site to see changes.");
        setSaving(false);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Custom CSS</h1>
                <p className="text-muted-foreground">Inject custom styles into your site</p>
            </div>

            <Card className="mb-6">
                <CardHeader><CardTitle>CSS Editor</CardTitle></CardHeader>
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
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : <><Check className="w-4 h-4 mr-2" /> Save CSS</>}
            </Button>
        </>
    );
}
