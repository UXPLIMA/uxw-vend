"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Link, useRouter } from "@/core/lib/i18n/navigation";
import { toast } from "sonner";
import { copyText } from "@/core/lib/copy-text";
import { AdminPageHeader } from "@/core/components/admin/AdminPageHeader";

/**
 * Creating an API key, on its own route.
 *
 * The secret is shown once and never again, so this screen does not redirect
 * on success the way the other create screens do - it stays and shows the key.
 * That is also why the key does not travel back to the list through a query
 * parameter: a URL ends up in history, in a proxy log and in a screenshot.
 */
export default function NewApiKeyPage() {
    const t = useTranslations("admin");
    const commonT = useTranslations("common");
    const router = useRouter();

    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/v1/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                const data = await res.json();
                setCreated(data.apiKey.key);
                toast.success(t("apiKeys_created"));
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || t("apiKeys_createError"));
            }
        } finally {
            setSaving(false);
        }
    };

    const copy = async () => {
        if (!created) return;
        if (!(await copyText(created))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            <AdminPageHeader
                title={t("apiKeys_newKey")}
                description={t("apiKeys_subtitle")}
                backHref="/admin/api-keys"
                backLabel={commonT("back")}
            />

            <Card>
                <CardContent className="p-6">
                    {created ? (
                        <div className="space-y-4">
                            <p className="text-sm font-medium">{t("apiKeys_keyCreated")}</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-lg border border-border font-mono select-all break-all">
                                    {created}
                                </code>
                                <Button aria-label={commonT("copy")} size="sm" variant="outline" onClick={copy}>
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                            <Button onClick={() => { router.push("/admin/api-keys"); router.refresh(); }}>
                                {commonT("back")}
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={submit} className="space-y-4 max-w-lg">
                            <div>
                                <Label htmlFor="api-key-name">{t("apiKeys_keyName")}</Label>
                                <Input
                                    id="api-key-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t("apiKeys_namePlaceholder")}
                                    required
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" disabled={saving}>
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("apiKeys_create")}
                                </Button>
                                <Link href="/admin/api-keys" className="inline-flex">
                                    <Button type="button" variant="outline" disabled={saving}>
                                        {commonT("cancel")}
                                    </Button>
                                </Link>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
