"use client";

import { useEffect, useRef, useState } from "react";
import { themeRegistry } from "@/core/generated/theme-registry";
import { CustomizerForm } from "@/core/components/admin/theme-customizer/CustomizerForm";
import { toast } from "sonner";

export default function CustomizerPage() {
    const [themeId, setThemeId] = useState<string>("flat");
    const [overrides, setOverrides] = useState<Record<string, unknown>>({});
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    useEffect(() => {
        fetch("/api/v1/themes/active")
            .then((r) => r.json())
            .then((d: { themeId: string; overrides: Record<string, unknown> }) => {
                if (d.themeId) setThemeId(d.themeId);
                if (d.overrides) setOverrides(d.overrides);
            })
            .catch(() => { /* leave defaults */ });
    }, []);

    const manifest = themeRegistry[themeId];
    if (!manifest) return <div className="p-6 text-sm">Unknown theme.</div>;

    function sendPreview(diff: Record<string, unknown>) {
        const target = iframeRef.current?.contentWindow;
        if (!target) return;
        target.postMessage({ type: "uxwvend:theme-preview", overrides: diff }, window.location.origin);
    }

    async function save(diff: Record<string, unknown>) {
        const res = await fetch(`/api/v1/themes/${themeId}/customization`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ overrides: diff }),
        });
        if (!res.ok) {
            toast.error("Failed to save customization");
            return;
        }
        setOverrides(diff);
        toast.success("Saved");
    }

    return (
        <div className="grid h-screen grid-cols-[360px_1fr]">
            <aside className="overflow-y-auto border-r p-4">
                <h2 className="mb-4 text-lg font-semibold">Theme customizer</h2>
                <CustomizerForm
                    manifest={manifest}
                    initialOverrides={overrides}
                    onPreview={sendPreview}
                    onSave={save}
                />
            </aside>
            <iframe ref={iframeRef} src="/" className="h-full w-full border-0" />
        </div>
    );
}
