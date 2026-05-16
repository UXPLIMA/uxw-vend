"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Plus, X, Trash2, Copy, Check, Key } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface ApiKeyItem {
    id: string;
    name: string;
    key: string;
    lastUsedAt: string | null;
    isActive: boolean;
    createdAt: string;
}

export default function ApiKeysPage() {
    const t = useTranslations("admin");
    const [keys, setKeys] = useState<ApiKeyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const { confirm } = useConfirm();

    const fetchKeys = useCallback(async () => {
        const res = await fetch("/api/v1/api-keys");
        if (res.ok) { const data = await res.json(); setKeys(data.keys || []); }
        setLoading(false);
    }, []);

     
    useEffect(() => { fetchKeys(); }, [fetchKeys]);

    const createKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const res = await fetch("/api/v1/api-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        if (res.ok) {
            const data = await res.json();
            setNewKey(data.apiKey.key);
            setName("");
            setShowForm(false);
            fetchKeys();
            toast.success("API key created");
        }
        setSaving(false);
    };

    const deleteKey = async (id: string) => {
        const ok = await confirm({ title: t("apiKeys_deleteTitle"), message: t("apiKeys_deleteMessage"), variant: "danger", confirmText: t("common_delete") });
        if (!ok) return;
        await fetch(`/api/v1/api-keys/${id}`, { method: "DELETE" });
        fetchKeys();
    };

    const copyKey = () => {
        if (newKey) { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{t("apiKeys_title")}</h1>
                    <p className="text-muted-foreground">{t("apiKeys_subtitle")}</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    {showForm ? <><X className="w-4 h-4 mr-2" /> {t("apiKeys_cancel")}</> : <><Plus className="w-4 h-4 mr-2" /> {t("apiKeys_newKey")}</>}
                </Button>
            </div>

            {newKey && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-2">{t("apiKeys_keyCreated")}</p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-muted px-3 py-2 rounded border border-border font-mono select-all">{newKey}</code>
                        <Button size="sm" variant="outline" onClick={copyKey}>
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            )}

            {showForm && (
                <Card className="mb-6">
                    <CardContent className="p-4">
                        <form onSubmit={createKey} className="flex items-end gap-3">
                            <div className="flex-1">
                                <Label>{t("apiKeys_keyName")}</Label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Integration" required />
                            </div>
                            <Button type="submit" disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("apiKeys_create")}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-0">
                    {keys.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t("apiKeys_noKeys")}</p>
                    ) : (
                        <div className="divide-y">
                            {keys.map((k) => (
                                <div key={k.id} className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3">
                                        <Key className="w-4 h-4 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">{k.name}</p>
                                            <p className="text-xs text-muted-foreground font-mono">{k.key}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</span>
                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteKey(k.id)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
